import { type ChatAttachment, ChatAttachmentSchema } from "@tokenring-ai/agent/AgentEvents";
import type TokenRingApp from "@tokenring-ai/app";
import type { IncomingMessage, IncomingMessageHandler, MembershipHandler, MessagingProvider, SendOptions } from "@tokenring-ai/bot";
import { ChannelType, Client, GatewayIntentBits, type Message, Partials } from "discord.js";
import type DiscordService from "./DiscordService.ts";
import type { ResolvedDiscordAccountConfig } from "./schema.ts";

/** Discord accepts 2000 characters per message; leave a little formatting room. */
const MAX_MESSAGE_LENGTH = 1990;

/** How many of our own message ids to remember for reply addressing. */
const OWN_MESSAGE_HISTORY = 2000;

type ReportedChannel = {
  guildId?: string | undefined;
  title?: string | undefined;
};

/**
 * One Discord application account, exposed as a messaging transport. Agent
 * selection, authorization, commands, and response streaming live in BotService.
 */
export default class DiscordMessagingProvider implements MessagingProvider {
  readonly maxMessageLength = MAX_MESSAGE_LENGTH;

  private client!: Client;
  private botUserId = "";
  private handlers = new Set<IncomingMessageHandler>();
  private membershipHandlers = new Set<MembershipHandler>();
  private ownMessages = new Set<string>();
  private reportedChannels = new Map<string, ReportedChannel>();

  constructor(
    private readonly app: TokenRingApp,
    private readonly service: DiscordService,
    readonly accountName: string,
    private readonly config: ResolvedDiscordAccountConfig,
  ) {}

  async start(): Promise<void> {
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages],
      partials: [Partials.Channel],
    });

    this.client.on("messageCreate", message => {
      void this.handleRawMessage(message).catch((error: unknown) => {
        this.app.serviceError(this.service, "Error processing Discord message:", error);
      });
    });

    this.client.on("channelDelete", channel => {
      void this.reportChannelRemoved(channel.id).catch((error: unknown) => {
        this.app.serviceError(this.service, "Error processing Discord channel removal:", error);
      });
    });

    this.client.on("guildDelete", guild => {
      void this.reportGuildRemoved(guild.id).catch((error: unknown) => {
        this.app.serviceError(this.service, "Error processing Discord guild removal:", error);
      });
    });

    await this.client.login(this.config.botToken);
    if (!this.client.user) throw new Error(`Discord account ${this.accountName} did not return a bot user after login.`);

    this.botUserId = this.client.user.id;
    this.app.serviceOutput(this.service, `Discord account ${this.accountName} connected as @${this.client.user.tag}`);
  }

  async stop(): Promise<void> {
    this.handlers.clear();
    this.membershipHandlers.clear();
    this.ownMessages.clear();
    this.reportedChannels.clear();
    await this.client.destroy();
  }

  onMessage(handler: IncomingMessageHandler): void {
    this.handlers.add(handler);
  }

  onMembershipChange(handler: MembershipHandler): void {
    this.membershipHandlers.add(handler);
  }

  /**
   * Guild channel ids address themselves. If the id is a Discord user, open
   * their DM channel and return that channel id.
   */
  async resolveConversation(targetId: string): Promise<string> {
    if (this.client.channels.cache.has(targetId)) return targetId;

    const cachedUser = this.client.users.cache.get(targetId);
    if (cachedUser) return (await cachedUser.createDM()).id;

    try {
      const channel = await this.client.channels.fetch(targetId);
      if (channel) return channel.id;
    } catch (error: unknown) {
      if (!isUnknownChannelError(error)) throw error;
    }

    const user = await this.client.users.fetch(targetId);
    return (await user.createDM()).id;
  }

  async sendMessage(conversationId: string, text: string, options?: SendOptions): Promise<string> {
    const channel = await this.fetchSendableChannel(conversationId);
    const message = await channel.send({
      content: text,
      ...(options?.replyToMessageId ? { reply: { messageReference: options.replyToMessageId, failIfNotExists: false } } : {}),
    });
    this.rememberOwnMessage(message.id);
    return message.id;
  }

  async updateMessage(conversationId: string, messageId: string, text: string): Promise<string> {
    try {
      const channel = await this.fetchSendableChannel(conversationId);
      const message = await channel.messages.fetch(messageId);
      const updated = await message.edit(text);
      return updated.id;
    } catch (error: unknown) {
      if (!isUnknownMessageError(error)) throw error;
      return this.sendMessage(conversationId, text);
    }
  }

  private async handleRawMessage(msg: Message): Promise<void> {
    if (!this.botUserId || msg.author.bot) return;

    const direct = msg.channel.type === ChannelType.DM;
    const roomId = msg.channel.isThread() ? (msg.channel.parentId ?? undefined) : undefined;
    if (!direct) await this.reportChannelOnFirstSight(msg, roomId);

    const ownMention = new RegExp(`<@!?${this.botUserId}>`, "g");
    const mentioned = ownMention.test(msg.content);
    ownMention.lastIndex = 0;
    const repliedTo = await this.isReplyToBot(msg);
    const hasAttachments = msg.attachments.size > 0;

    const message: IncomingMessage = {
      conversationId: msg.channelId,
      roomId,
      userId: msg.author.id,
      userName: msg.author.username ? `${msg.member?.displayName ?? msg.author.displayName} (@${msg.author.username})` : msg.author.displayName,
      text: mentioned
        ? msg.content
            .replace(ownMention, "")
            .replace(/\s{2,}/g, " ")
            .trim()
        : msg.content,
      messageId: msg.id,
      replyToMessageId: msg.reference?.messageId ?? undefined,
      hasAttachments,
      attachments: hasAttachments ? this.deferAttachments(msg) : undefined,
      direct,
      addressed: direct || mentioned || repliedTo,
    };

    for (const handler of this.handlers) {
      await handler(message);
    }
  }

  private async isReplyToBot(msg: Message): Promise<boolean> {
    const messageId = msg.reference?.messageId;
    if (!messageId) return false;
    if (this.ownMessages.has(messageId)) return true;

    try {
      return (await msg.fetchReference()).author.id === this.botUserId;
    } catch (error: unknown) {
      if (isUnknownMessageError(error)) return false;
      throw error;
    }
  }

  /**
   * Discord has no per-channel invite event: an application joins a guild and
   * can see whichever channels its role permits. First traffic from a channel
   * therefore reports it as observed, which makes it discoverable without
   * incorrectly triggering an invitation-based auto-join policy.
   */
  private async reportChannelOnFirstSight(msg: Message, roomId: string | undefined): Promise<void> {
    const conversationId = roomId ?? msg.channelId;
    if (this.reportedChannels.has(conversationId)) return;

    const channel = roomId ? (msg.channel.isThread() ? msg.channel.parent : undefined) : msg.channel;
    const title = channel && "name" in channel ? channel.name : undefined;
    this.reportedChannels.set(conversationId, { guildId: msg.guildId ?? undefined, title: title ?? undefined });
    this.app.serviceOutput(this.service, `Discord account ${this.accountName} is in ${title ?? "a channel"} (${conversationId})`);

    for (const handler of this.membershipHandlers) {
      await handler({ conversationId, title: title ?? undefined, joined: true, via: "observed" });
    }
  }

  private async reportChannelRemoved(conversationId: string): Promise<void> {
    const reported = this.reportedChannels.get(conversationId);
    if (!reported) return;
    this.reportedChannels.delete(conversationId);

    for (const handler of this.membershipHandlers) {
      await handler({ conversationId, title: reported.title, joined: false, via: "invite" });
    }
  }

  private async reportGuildRemoved(guildId: string): Promise<void> {
    const channelIds = [...this.reportedChannels].filter(([, channel]) => channel.guildId === guildId).map(([conversationId]) => conversationId);
    for (const conversationId of channelIds) {
      await this.reportChannelRemoved(conversationId);
    }
  }

  private rememberOwnMessage(messageId: string): void {
    this.ownMessages.add(messageId);
    if (this.ownMessages.size <= OWN_MESSAGE_HISTORY) return;
    const oldest = this.ownMessages.values().next().value;
    if (oldest) this.ownMessages.delete(oldest);
  }

  private deferAttachments(msg: Message): () => Promise<ChatAttachment[]> {
    let pending: Promise<ChatAttachment[]> | undefined;
    return () => (pending ??= this.extractAllAttachments(msg));
  }

  private async extractAllAttachments(msg: Message): Promise<ChatAttachment[]> {
    const attachments: ChatAttachment[] = [];

    for (const attachment of msg.attachments.values()) {
      if (attachment.size > this.config.maxFileSize) {
        this.app.serviceOutput(this.service, `Discord attachment ${attachment.id} exceeded maxFileSize (${attachment.size} bytes), skipping`);
        continue;
      }

      const mimeType = ChatAttachmentSchema.shape.mimeType.safeParse(attachment.contentType);
      if (!mimeType.success) {
        this.app.serviceOutput(
          this.service,
          `Discord attachment ${attachment.name || attachment.id} has unsupported type ${attachment.contentType ?? "unknown"}, skipping`,
        );
        continue;
      }

      try {
        const response = await fetch(attachment.url);
        if (!response.ok) throw new Error(`Discord returned ${response.status} ${response.statusText}`);
        const body = Buffer.from(await response.arrayBuffer()).toString("base64");
        attachments.push({
          name: attachment.name || `discord_file_${attachment.id}`,
          mimeType: mimeType.data,
          body,
          encoding: "base64",
        });
      } catch (error: unknown) {
        this.app.serviceError(this.service, `Failed to fetch Discord attachment ${attachment.id}:`, error);
      }
    }

    return attachments;
  }

  private async fetchSendableChannel(channelId: string) {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel?.isSendable() || !("messages" in channel)) {
      throw new Error(`Discord channel ${channelId} is not sendable or is inaccessible.`);
    }
    return channel;
  }
}

function discordErrorCode(error: unknown): number | string | undefined {
  return typeof error === "object" && error !== null && "code" in error ? (error as { code?: number | string }).code : undefined;
}

function isUnknownChannelError(error: unknown): boolean {
  return discordErrorCode(error) === 10003 || (Error.isError(error) && error.message.toLowerCase().includes("unknown channel"));
}

function isUnknownMessageError(error: unknown): boolean {
  return discordErrorCode(error) === 10008 || (Error.isError(error) && error.message.toLowerCase().includes("unknown message"));
}

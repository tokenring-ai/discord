import {type Agent, AgentManager} from "@tokenring-ai/agent";
import {BaseAttachmentSchema, type InputAttachment} from "@tokenring-ai/agent/AgentEvents";
import {AgentEventState} from "@tokenring-ai/agent/state/agentEventState";
import type TokenRingApp from "@tokenring-ai/app";
import type {CommunicationChannel} from "@tokenring-ai/escalation/EscalationProvider";
import type {MaybePromise} from "bun";
import {ChannelType, Client, GatewayIntentBits, type Message, type TextBasedChannel} from "discord.js";
import type DiscordService from "./DiscordService.ts";
import type {ParsedDiscordBotConfig} from "./schema.ts";
import {splitIntoChunks} from "./splitIntoChunks.ts";

type UserChannel = {
  destinationId: string;
  trackedMessageIds: Set<string>;
  queue: string[];
  resolve?: (value: IteratorResult<string>) => void;
  closed: boolean;
};

type ChatResponse = {
  text: string | null;
  messageIds: (string | undefined)[];
  sentTexts: string[];
  isComplete?: boolean;
};

type MessageCapableChannel = TextBasedChannel & {
  send: (content: string) => Promise<Message>;
  messages: {
    fetch: (id: string) => Promise<Message>;
  };
};

export default class DiscordBot {
  private client!: Client;
  private botUserId?: string;
  private channelAgents = new Map<string, Agent>();
  private userChannels = new Map<string, UserChannel>();
  private chatResponses = new Map<string, ChatResponse>();
  private lastSendTime = 0;
  private sendTimer: NodeJS.Timeout | null = null;
  private pendingChannelIds = new Set<string>();
  private isProcessing = false;
  private messageIdToBotUserId = new Map<string, string>();
  private activeRequests = new Map<
    string,
    { channelId: string; responseSent: boolean }
  >();
  private channelListeners = new Set<string>();

  constructor(
    private app: TokenRingApp,
    private discordService: DiscordService,
    private botName: string,
    private botConfig: ParsedDiscordBotConfig,
  ) {
  }

  async start(): Promise<void> {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
    });

    this.client.on("messageCreate", async (message) => {
      try {
        await this.handleMessage(message);
      } catch (error) {
        this.app.serviceError(
          this.discordService,
          "Error processing message:",
          error,
        );
      }
    });

    await this.client.login(this.botConfig.botToken);

    const me = this.client.user;
    if (!me) {
      throw new Error(
        `Discord bot ${this.botName} failed to initialize user state after login.`,
      );
    }

    this.botUserId = me.id;
    this.app.serviceOutput(
      this.discordService,
      `Bot ${this.botName} (${me.tag}) started`,
    );

    if (this.botConfig.joinMessage) {
      for (const channelConfig of Object.values(this.botConfig.channels)) {
        try {
          await this.sendMessage(
            channelConfig.channelId,
            this.botConfig.joinMessage,
          );
        } catch (error) {
          this.app.serviceError(
            this.discordService,
            `Failed to announce to channel ${channelConfig.channelId}:`,
            error,
          );
        }
      }
    }
  }

  async stop(): Promise<void> {
    if (this.sendTimer) {
      clearTimeout(this.sendTimer);
      this.sendTimer = null;
    }

    const channelIds = [...this.pendingChannelIds];
    for (const channelId of channelIds) {
      await this.flushBuffer(channelId);
    }

    this.pendingChannelIds.clear();
    this.chatResponses.clear();
    this.channelListeners.clear();
    this.activeRequests.clear();

    const agentManager = this.app.requireService(AgentManager);
    for (const agentPromise of this.channelAgents.values()) {
      const agent = await agentPromise;
      await agentManager.deleteAgent(agent.id, "Discord bot was shut down.");
    }
    this.channelAgents.clear();

    this.client.destroy();
  }

  createCommunicationChannelWithChannel(
    channelName: string,
  ): CommunicationChannel {
    const channelConfig = this.botConfig.channels[channelName];
    if (!channelConfig) {
      throw new Error(`Channel "${channelName}" not found in configuration.`);
    }

    return this.createTrackedChannel(
      channelConfig.channelId,
      async (messageText) => {
        const channel = await this.fetchTextChannel(channelConfig.channelId);
        const sent = await channel.send(messageText);
        return sent.id;
      },
    );
  }

  createCommunicationChannelWithUser(userId: string): CommunicationChannel {
    return this.createTrackedChannel(userId, async (messageText) => {
      const user = await this.client.users.fetch(userId);
      const dm = await user.createDM();
      const sent = await dm.send(messageText);
      return sent.id;
    });
  }

  private createTrackedChannel(
    destinationId: string,
    sendFn: (messageText: string) => Promise<string>,
  ): CommunicationChannel {
    const trackedMessageIds = new Set<string>();

    const channel: UserChannel = {
      destinationId,
      trackedMessageIds,
      queue: [],
      closed: false,
    };

    return {
      send: async (messageText: string) => {
        const messageId = await sendFn(messageText);
        trackedMessageIds.add(messageId);
        this.userChannels.set(messageId, channel);
        if (this.botUserId) {
          this.messageIdToBotUserId.set(messageId, this.botUserId);
        }
      },
      receive: async function* (): AsyncGenerator<string> {
        while (!channel.closed) {
          const el = channel.queue.shift();
          if (el) {
            yield el;
          } else {
            await new Promise<IteratorResult<string>>((resolve) => {
              channel.resolve = resolve;
            });
          }
        }
      },
      [Symbol.dispose]: () => {
        channel.closed = true;
        if (channel.resolve) {
          channel.resolve({value: undefined, done: true});
          channel.resolve = undefined;
        }

        for (const messageId of trackedMessageIds) {
          this.userChannels.delete(messageId);
          this.messageIdToBotUserId.delete(messageId);
        }
        trackedMessageIds.clear();
      },
    };
  }

  private async handleMessage(message: Message): Promise<void> {
    if (!this.botUserId || message.author.bot) return;

    const userId = message.author.id;
    const channelId = message.channelId;
    const text = message.content?.trim() ?? "";

    const replyToMessageId = message.reference?.messageId;
    if (replyToMessageId) {
      const replyToBotUserId = this.messageIdToBotUserId.get(replyToMessageId);
      if (replyToBotUserId === this.botUserId) {
        const channel = this.userChannels.get(replyToMessageId);
        if (channel && text) {
          channel.trackedMessageIds.add(message.id);
          this.userChannels.set(message.id, channel);
          this.messageIdToBotUserId.set(message.id, this.botUserId);

          if (channel.resolve) {
            channel.resolve({value: text, done: false});
            channel.resolve = undefined;
          } else {
            channel.queue.push(text);
          }
          return;
        }
      }
    }

    if (message.channel.type === ChannelType.DM) {
      await this.handleDirectMessage(message, userId, channelId, text);
      return;
    }

    const channelConfig = Object.values(this.botConfig.channels).find(
      (c) => c.channelId === channelId,
    );
    if (!channelConfig) return;

    if (!message.mentions.users.has(this.botUserId)) return;

    if (
      channelConfig.allowedUsers.length > 0 &&
      !channelConfig.allowedUsers.includes(userId)
    ) {
      await message.reply("Sorry, you are not authorized.");
      return;
    }

    const cleanText = text.replace(/<@!?\d+>/g, "").trim();
    const attachments = await this.extractAllAttachments(message);
    if (!cleanText && attachments.length === 0) return;

    const agent = await this.ensureAgentForChannel(
      channelId,
      channelConfig.agentType,
    );
    await agent.waitForState(AgentEventState, (state) => state.idle);

    this.chatResponses.set(channelId, {
      text: null,
      messageIds: [],
      sentTexts: [],
    });

    const requestId = agent.handleInput({
      from: `Discord message from ${message.author.username}`,
      message: `/chat send From: ${message.author.displayName}, Username: (@${message.author.username}) ${cleanText || "No text sent"}`,
      attachments,
    });
    this.activeRequests.set(requestId, {channelId, responseSent: false});

    await this.flushBuffer(channelId);
  }

  private async handleDirectMessage(
    message: Message,
    userId: string,
    channelId: string,
    text: string,
  ): Promise<void> {
    if (!this.botConfig.dmAgentType) {
      if (text.length > 0 || message.attachments.size > 0) {
        await message.reply("DMs are not enabled for this bot.");
      }
      return;
    }

    if (
      this.botConfig.dmAllowedUsers.length > 0 &&
      !this.botConfig.dmAllowedUsers.includes(userId)
    ) {
      await message.reply("Sorry, you are not authorized to DM this bot.");
      return;
    }

    const attachments = await this.extractAllAttachments(message);
    if (!text && attachments.length === 0) return;

    const agent = await this.ensureAgentForChannel(
      userId,
      this.botConfig.dmAgentType,
    );
    await agent.waitForState(AgentEventState, (state) => state.idle);

    this.chatResponses.set(channelId, {
      text: null,
      messageIds: [],
      sentTexts: [],
    });

    const requestId = agent.handleInput({
      from: `Discord message from ${message.author.username}`,
      message: `/chat send From: ${message.author.displayName}, Username: (@${message.author.username}) ${text || "No text sent"}`,
      attachments,
    });
    this.activeRequests.set(requestId, {channelId, responseSent: false});

    await this.flushBuffer(channelId);
  }

  private async extractAllAttachments(
    message: Message,
  ): Promise<InputAttachment[]> {
    const attachments: InputAttachment[] = [];

    for (const attachment of message.attachments.values()) {
      if (attachment.size > this.botConfig.maxFileSize) {
        this.app.serviceOutput(
          this.discordService,
          `Discord attachment ${attachment.id} exceeded maxFileSize (${attachment.size} bytes), skipping.`,
        );
        continue;
      }

      if (!attachment.url) continue;

      try {
        const response = await fetch(attachment.url);
        if (!response.ok) {
          throw new Error(`Failed to fetch attachment: ${response.statusText}`);
        }
        const data = await response.arrayBuffer();

        const mimeType = BaseAttachmentSchema.shape.mimeType.parse(attachment.contentType);

        attachments.push({
          type: "attachment",
          name: attachment.name || `discord_file_${attachment.id}`,
          mimeType,
          body: Buffer.from(data as ArrayBuffer).toString("base64"),
          encoding: "base64",
          timestamp: Date.now(),
        });
      } catch (error) {
        this.app.serviceError(
          this.discordService,
          `Failed to fetch Discord attachment ${attachment.id}:`,
          error,
        );
      }
    }

    return attachments;
  }

  private ensureAgentForChannel(
    channelId: string,
    agentType: string,
  ): MaybePromise<Agent> {
    if (!this.channelAgents.has(channelId)) {
      const agentManager = this.app.requireService(AgentManager);
      const agent = agentManager.spawnAgent({agentType, headless: true});
      this.channelAgents.set(channelId, agent);
    }

    const agent = this.channelAgents.get(channelId)!;

    if (!this.channelListeners.has(channelId)) {
      this.channelListeners.add(channelId);
      agent.runBackgroundTask((signal) =>
        this.agentEventLoop(channelId, agent, signal),
      );
    }

    return agent;
  }

  private async agentEventLoop(
    channelId: string,
    agent: Agent,
    signal: AbortSignal,
  ): Promise<void> {
    const eventCursor = agent
      .getState(AgentEventState)
      .getEventCursorFromCurrentPosition();

    try {
      for await (const state of agent.subscribeStateAsync(
        AgentEventState,
        signal,
      )) {
        for (const event of state.yieldEventsByCursor(eventCursor)) {
          switch (event.type) {
            case "output.chat": {
              for (const req of this.activeRequests.values()) {
                if (req.channelId === channelId) req.responseSent = true;
              }
              this.handleChatOutput(channelId, event.message);
              break;
            }
            case "output.info":
            case "output.warning":
            case "output.error": {
              for (const req of this.activeRequests.values()) {
                if (req.channelId === channelId) req.responseSent = true;
              }
              this.handleChatOutput(
                channelId,
                `\n[${event.type.split(".")[1].toUpperCase()}]: ${event.message}\n`,
              );
              break;
            }
            case "agent.response": {
              const request = this.activeRequests.get(event.requestId);
              if (request) {
                const response = this.chatResponses.get(request.channelId);
                if (response) {
                  response.isComplete = true;
                  await this.flushBuffer(request.channelId);
                }

                if (!request.responseSent) {
                  await this.sendMessage(
                    request.channelId,
                    "No response received from agent.",
                  );
                }
                this.activeRequests.delete(event.requestId);
              }
              break;
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        this.app.serviceError(
          this.discordService,
          "Error in channel listener:",
          error,
        );
      }
    } finally {
      this.channelListeners.delete(channelId);
    }
  }

  private handleChatOutput(channelId: string, content: string): void {
    const response = this.chatResponses.get(channelId);
    if (!response)
      throw new Error(`No response found for channel ${channelId}`);

    if (response.text === null) response.text = "";
    response.text += content;

    this.pendingChannelIds.add(channelId);
    this.scheduleSend();
  }

  private scheduleSend(): void {
    if (this.sendTimer !== null || this.isProcessing) return;
    const now = Date.now();
    const delay = Math.max(0, this.lastSendTime + 250 - now);
    this.sendTimer = setTimeout(() => this.processPending(), delay);
  }

  private async processPending(): Promise<void> {
    if (this.isProcessing) return;
    this.sendTimer = null;
    this.isProcessing = true;

    try {
      const channelIds = [...this.pendingChannelIds];
      this.pendingChannelIds.clear();

      for (const channelId of channelIds) {
        await this.flushBuffer(channelId);
      }

      this.lastSendTime = Date.now();
    } finally {
      this.isProcessing = false;
      if (this.pendingChannelIds.size > 0) {
        this.scheduleSend();
      }
    }
  }

  private async flushBuffer(channelId: string): Promise<void> {
    const response = this.chatResponses.get(channelId);
    if (!response) return;

    const chunks = splitIntoChunks(response.text);
    let hadErrors = false;

    const syncFrom = response.isComplete ? 0 : Math.max(0, chunks.length - 2);

    for (let i = syncFrom; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (chunk === response.sentTexts[i]) continue;

      try {
        const existingMessageId = response.messageIds[i];
        if (existingMessageId) {
          const updatedMessageId = await this.updateMessageWithFallback(
            channelId,
            existingMessageId,
            chunk,
          );
          response.messageIds[i] = updatedMessageId;
        } else {
          const postedMessageId = await this.sendMessage(channelId, chunk);
          response.messageIds[i] = postedMessageId;
        }
        response.sentTexts[i] = chunk;
      } catch (error) {
        hadErrors = true;
        this.app.serviceError(
          this.discordService,
          "Error flushing buffer:",
          error,
        );
      }
    }

    if (response.isComplete && !hadErrors) {
      this.chatResponses.delete(channelId);
    } else if (response.isComplete && hadErrors) {
      this.pendingChannelIds.add(channelId);
      this.scheduleSend();
    }
  }

  private async sendMessage(channelId: string, text: string): Promise<string> {
    const channel = await this.fetchTextChannel(channelId);
    const message = await channel.send(text);

    if (this.botUserId) {
      this.messageIdToBotUserId.set(message.id, this.botUserId);
    }

    return message.id;
  }

  private async updateMessageWithFallback(
    channelId: string,
    messageId: string,
    text: string,
  ): Promise<string> {
    try {
      const channel = await this.fetchTextChannel(channelId);
      const existingMessage = await channel.messages.fetch(messageId);
      const updated = await existingMessage.edit(text);
      return updated.id;
    } catch (error) {
      if (!this.isMessageNotFoundError(error)) throw error;
      return this.sendMessage(channelId, text);
    }
  }

  private isMessageNotFoundError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const message = error.message.toLowerCase();
    return message.includes("unknown message") || message.includes("10008");
  }

  private async fetchTextChannel(
    channelId: string,
  ): Promise<MessageCapableChannel> {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel?.isTextBased()) {
      throw new Error(
        `Channel ${channelId} is not text-based or is inaccessible.`,
      );
    }

    if (!("messages" in channel)) {
      throw new Error(
        `Channel ${channelId} does not support message operations.`,
      );
    }

    return channel as MessageCapableChannel;
  }

  getBotUserId(): string | undefined {
    return this.botUserId;
  }
}

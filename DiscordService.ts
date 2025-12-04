import {AgentEventState} from "@tokenring-ai/agent/state/agentEventState";
import {Client, GatewayIntentBits, Message, TextChannel} from 'discord.js';
import TokenRingApp from "@tokenring-ai/app";
import {Agent, AgentManager} from "@tokenring-ai/agent";
import {TokenRingService} from "@tokenring-ai/app/types";
import {z} from "zod";

export const DiscordServiceConfigSchema = z.object({
  botToken: z.string().min(1, "Bot token is required"),
  channelId: z.string().optional(),
  authorizedUserIds: z.array(z.string()).optional(),
  defaultAgentType: z.string().optional()
});

export type DiscordServiceConfig = z.infer<typeof DiscordServiceConfigSchema>;

export default class DiscordService implements TokenRingService {
  name = "DiscordService";
  description = "Provides a Discord bot for interacting with TokenRing agents.";
  private running = false;
  private readonly botToken: string;
  private readonly channelId?: string;
  private authorizedUserIds: string[] = [];
  private readonly defaultAgentType: string;
  private client: Client | null = null;
  private app: TokenRingApp;
  private userAgents = new Map<string, Agent>();

  constructor(app: TokenRingApp, {botToken, channelId, authorizedUserIds, defaultAgentType}: DiscordServiceConfig) {
    if (!botToken) {
      throw new Error("DiscordService requires a botToken.");
    }
    this.app = app;
    this.botToken = botToken;
    this.channelId = channelId;
    this.authorizedUserIds = authorizedUserIds || [];
    this.defaultAgentType = defaultAgentType || "teamLeader";
  }

  async start(): Promise<void> {
    this.running = true;

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
      ]
    });

    this.client.on('messageCreate', async (message: Message) => {
      if (message.author.bot) return;

      const userId = message.author.id;
      const isMention = message.mentions.has(this.client!.user!);
      const isDM = message.channel.isDMBased();

      if (!isMention && !isDM) return;

      if (this.authorizedUserIds.length > 0 && !this.authorizedUserIds.includes(userId)) {
        await message.reply("Sorry, you are not authorized to use this bot.");
        return;
      }

      const cleanText = isMention
        ? message.content.replace(/<@!?\d+>/g, '').trim()
        : message.content.trim();

      if (!cleanText) return;

      const agent = await this.getOrCreateAgentForUser(userId);

      // Wait for agent to be idle before sending new message
      const initialState = await agent.waitForState(AgentEventState, (state) => state.idle);
      const eventCursor = initialState.getEventCursorFromCurrentPosition();

      // Send the message to the agent
      const requestId = agent.handleInput({message: cleanText});

      // Subscribe to agent events to process the response
      const unsubscribe = agent.subscribeState(AgentEventState, (state) => {
        for (const event of state.yieldEventsByCursor(eventCursor)) {
          switch (event.type) {
            case 'output.chat':
              this.handleChatOutput(message, event.data.content);
              break;
            case 'output.system':
              this.handleSystemOutput(message, event.data.message, event.data.level);
              break;
            case 'input.handled':
              if (event.data.requestId === requestId) {
                unsubscribe();
                // If no response was sent, send a default message
                if (!this.lastResponseSent) {
                  message.reply("No response received from agent.");
                }
              }
              break;
          }
        }
      });

      // Set timeout for the response
      if (agent.config.maxRunTime > 0) {
        setTimeout(() => {
          unsubscribe();
          message.reply(`Agent timed out after ${agent.config.maxRunTime} seconds.`);
        }, agent.config.maxRunTime * 1000);
      }
    });

    await this.client.login(this.botToken);

    if (this.channelId) {
      const channel = await this.client.channels.fetch(this.channelId);
      if (channel?.isTextBased()) {
        await (channel as TextChannel).send("Discord bot is online!");
      }
    }
  }

  private lastResponseSent = false;

  private async handleChatOutput(message: Message, content: string): Promise<void> {
    // Accumulate chat content and send when complete
    this.lastResponseSent = true;
    // Discord has a 2000 character limit per message
    const chunks = this.chunkText(content, 2000);
    for (const chunk of chunks) {
      await message.reply(chunk);
    }
  }

  private async handleSystemOutput(message: Message, messageText: string, level: string): Promise<void> {
    const formattedMessage = `[${level.toUpperCase()}]: ${messageText}`;
    await message.reply(formattedMessage);
  }

  private chunkText(text: string, maxLength: number): string[] {
    const chunks: string[] = [];
    let currentChunk = '';

    for (const line of text.split('\n')) {
      if (currentChunk.length + line.length + 1 <= maxLength) {
        currentChunk += (currentChunk ? '\n' : '') + line;
      } else {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = line;
      }
    }

    if (currentChunk) chunks.push(currentChunk);
    return chunks;
  }

  async stop(): Promise<void> {
    const agentManager = this.app.requireService(AgentManager);
    this.running = false;

    for (const [userId, agent] of this.userAgents.entries()) {
      await agentManager.deleteAgent(agent);
    }
    this.userAgents.clear();

    if (this.client) {
      await this.client.destroy();
      this.client = null;
    }
  }

  private async getOrCreateAgentForUser(userId: string): Promise<Agent> {
    const agentManager = this.app.requireService(AgentManager);
    if (!this.userAgents.has(userId)) {
      const agent = await agentManager.spawnAgent({ agentType: this.defaultAgentType, headless: false });
      this.userAgents.set(userId, agent);
    }
    return this.userAgents.get(userId)!;
  }
}
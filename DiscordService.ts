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
      let response = "";

      for await (const event of agent.events(new AbortController().signal)) {
        if (event.type === 'output.chat') {
          response += event.data.content;
        } else if (event.type === 'output.system') {
          response += `\n[${event.data.level.toUpperCase()}]: ${event.data.message}\n`;
        } else if (event.type === 'state.idle') {
          if (response) {
            await message.reply(response.slice(0, 2000));
            break;
          }
          await agent.handleInput({message: cleanText});
          response = "";
        }
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
      const agent = await agentManager.spawnAgent(this.defaultAgentType);
      this.userAgents.set(userId, agent);
    }
    return this.userAgents.get(userId)!;
  }
}

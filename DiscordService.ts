import {Agent, AgentManager} from "@tokenring-ai/agent";
import {AgentEventState} from "@tokenring-ai/agent/state/agentEventState";
import {AgentExecutionState} from "@tokenring-ai/agent/state/agentExecutionState";
import TokenRingApp from "@tokenring-ai/app";
import {TokenRingService} from "@tokenring-ai/app/types";
import waitForAbort from "@tokenring-ai/utility/promise/waitForAbort";
import {Client, GatewayIntentBits, Message, TextChannel} from 'discord.js';
import {z} from "zod";

export const DiscordServiceConfigSchema = z.object({
  botToken: z.string().min(1, "Bot token is required"),
  channelId: z.string(),
  authorizedUserIds: z.array(z.string()),
  defaultAgentType: z.string()
});

export type DiscordServiceConfig = z.infer<typeof DiscordServiceConfigSchema>;

export default class DiscordService implements TokenRingService {
  readonly name = "DiscordService";
  description = "Provides a Discord bot for interacting with TokenRing agents.";
  private running = false;
  private client: Client | null = null;
  private userAgents = new Map<string, Agent>();

  constructor(private readonly app: TokenRingApp, private readonly options: DiscordServiceConfig) {
  }

  async run(signal: AbortSignal): Promise<void> {
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

      if (this.options.authorizedUserIds.length > 0 && !this.options.authorizedUserIds.includes(userId)) {
        await message.reply("Sorry, you are not authorized to use this bot.");
        return;
      }

      const cleanText = isMention
        ? message.content.replace(/<@!?\d+>/g, '').trim()
        : message.content.trim();

      if (!cleanText) return;

      const agent = await this.getOrCreateAgentForUser(userId);

      // Wait for agent to be idle before sending new message
      await agent.waitForState(AgentExecutionState, (state) => state.idle);
      const eventCursor = agent.getState(AgentEventState).getEventCursorFromCurrentPosition();

      // Send the message to the agent
      const requestId = agent.handleInput({message: cleanText});

      // Subscribe to agent events to process the response
      const unsubscribe = agent.subscribeState(AgentEventState, (state) => {
        for (const event of state.yieldEventsByCursor(eventCursor)) {
          switch (event.type) {
            case 'output.chat':
              this.handleChatOutput(message, event.message);
              break;
            case 'output.info':
              this.handleSystemOutput(message, event.message, 'info');
              break;
            case 'output.warning':
              this.handleSystemOutput(message, event.message, 'warning');
              break;
            case 'output.error':
              this.handleSystemOutput(message, event.message, 'error');
              break;
            case 'input.handled':
              if (event.requestId === requestId) {
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

    await this.client.login(this.options.botToken);

    if (this.options.channelId) {
      const channel = await this.client.channels.fetch(this.options.channelId);
      if (channel?.isTextBased()) {
        await (channel as TextChannel).send("Discord bot is online!");
      }
    }
    return waitForAbort(signal, async (ev) => {
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
    });
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



  private async getOrCreateAgentForUser(userId: string): Promise<Agent> {
    const agentManager = this.app.requireService(AgentManager);
    if (!this.userAgents.has(userId)) {
      const agent = await agentManager.spawnAgent({agentType: this.options.defaultAgentType, headless: false});
      this.userAgents.set(userId, agent);
    }
    return this.userAgents.get(userId)!;
  }
}
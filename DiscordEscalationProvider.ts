import type { Agent } from "@tokenring-ai/agent";
import type { CommunicationChannel, EscalationProvider } from "@tokenring-ai/escalation/EscalationProvider";
import DiscordService from "./DiscordService.ts";
import type { ParsedDiscordEscalationProviderConfig } from "./schema.ts";

export default class DiscordEscalationProvider implements EscalationProvider {
  constructor(readonly config: ParsedDiscordEscalationProviderConfig) {}

  createCommunicationChannelWithUser(channelName: string, agent: Agent): CommunicationChannel {
    const discordService = agent.requireServiceByType(DiscordService);

    const bot = discordService.getBot(this.config.bot);
    if (!bot) throw new Error(`Bot ${this.config.bot} not found`);

    return bot.createCommunicationChannelWithChannel(channelName);
  }
}

import {Agent} from "@tokenring-ai/agent";
import type {CommunicationChannel, EscalationProvider} from "@tokenring-ai/escalation/EscalationProvider";
import type {ParsedDiscordEscalationProviderConfig} from "./schema.ts";
import DiscordService from "./DiscordService.ts";

export default class DiscordEscalationProvider implements EscalationProvider {
  constructor(readonly config: ParsedDiscordEscalationProviderConfig) {}

  async createCommunicationChannelWithUser(channelName: string, agent: Agent): Promise<CommunicationChannel> {
    const discordService = agent.requireServiceByType(DiscordService);

    const bot = discordService.getBot(this.config.bot);
    if (!bot) throw new Error(`Bot ${this.config.bot} not found`);

    return bot.createCommunicationChannelWithChannel(channelName);
  }
}

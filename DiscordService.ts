import TokenRingApp from "@tokenring-ai/app";
import {TokenRingService} from "@tokenring-ai/app/types";
import waitForAbort from "@tokenring-ai/utility/promise/waitForAbort";
import KeyedRegistry from "@tokenring-ai/utility/registry/KeyedRegistry";
import DiscordBot from "./DiscordBot.ts";
import type {ParsedDiscordServiceConfig} from "./schema.ts";

export default class DiscordService implements TokenRingService {
  readonly name = "DiscordService";
  description = "Manages multiple Discord bots for interacting with TokenRing agents.";

  private bots = new KeyedRegistry<DiscordBot>();

  getAvailableBots = this.bots.getAllItemNames;
  getBot = this.bots.getItemByName;

  constructor(private app: TokenRingApp, private options: ParsedDiscordServiceConfig) {}

  async run(signal: AbortSignal): Promise<void> {
    this.app.serviceOutput(this, "Starting Discord bots...");

    for (const [botName, botConfig] of Object.entries(this.options.bots)) {
      const bot = new DiscordBot(this.app, this, botName, botConfig);
      await bot.start();
      this.bots.register(botName, bot);
    }

    return waitForAbort(signal, async () => {
      for (const [botName, bot] of this.bots.entries()) {
        await bot.stop();
        this.bots.unregister(botName);
      }
    });
  }
}

import {TokenRingPlugin} from "@tokenring-ai/app";
import {EscalationService} from "@tokenring-ai/escalation";
import {z} from "zod";
import DiscordService from "./DiscordService.ts";
import {DiscordEscalationProvider} from "./index.ts";
import packageJSON from "./package.json" with {type: "json"};
import {DiscordServiceConfigSchema, type ParsedDiscordBotConfig} from "./schema.ts";

const packageConfigSchema = z.object({
  discord: DiscordServiceConfigSchema.prefault({bots: {}}),
});

function addBotsFromEnv(bots: Record<string, Partial<ParsedDiscordBotConfig>>) {
  for (const [key, value] of Object.entries(process.env)) {
    const match = key.match(/^DISCORD_BOT_TOKEN(\d*)$/);
    if (!match || !value) continue;
    const n = match[1];
    const name = process.env[`DISCORD_BOT_NAME${n}`] ?? `Discord Bot${n ? ` ${n}` : ""}`;
    bots[name] = {
      name,
      botToken: value,
      escalation: process.env[`DISCORD_ESCALATION_CHANNEL${n}`]
        ? {channel: process.env[`DISCORD_ESCALATION_CHANNEL${n}`]!}
        : undefined,
      channels: {},
    };
  }
}

export default {
  name: packageJSON.name,
  displayName: "Discord Integration",
  version: packageJSON.version,
  description: packageJSON.description,
  install(app, config) {
    addBotsFromEnv(config.discord.bots);
    if (Object.keys(config.discord.bots).length === 0) return;

    app.addServices(new DiscordService(app, DiscordServiceConfigSchema.parse(config.discord)));

    app.waitForService(EscalationService, escalationService => {
      for (const [botName, bot] of Object.entries(config.discord.bots)) {
        if (bot.escalation) {
          escalationService.registerProvider(botName, new DiscordEscalationProvider({type: "discord", bot: botName, channel: bot.escalation.channel}));
        }
      }
    });
  },
  config: packageConfigSchema,
} satisfies TokenRingPlugin<typeof packageConfigSchema>;

import { AgentCommandService } from "@tokenring-ai/agent";
import type { TokenRingPlugin } from "@tokenring-ai/app";
import { requireSecret } from "@tokenring-ai/secrets/SecretService";
import { z } from "zod";
import agentCommands from "./commands.ts";
import DiscordService from "./DiscordService.ts";
import packageJSON from "./package.json" with { type: "json" };
import { DiscordServiceConfigSchema, type ResolvedDiscordAccountConfig } from "./schema.ts";

const packageConfigSchema = z.object({
  discord: DiscordServiceConfigSchema.prefault({ accounts: {} }),
});

export default {
  name: packageJSON.name,
  displayName: "Discord Integration",
  version: packageJSON.version,
  description: packageJSON.description,
  install(app) {
    app.addService(new DiscordService(app));
    app.waitForService(AgentCommandService, commandService => {
      commandService.addAgentCommands(agentCommands);
    });
  },
  async reconfigure(app, config) {
    const resolvedAccounts: Record<string, ResolvedDiscordAccountConfig> = {};
    for (const [accountName, account] of Object.entries(config.discord.accounts)) {
      resolvedAccounts[accountName] = {
        ...account,
        botToken: requireSecret(app, account.botToken, `Discord account "${accountName}" bot token`),
      };
    }

    await app.requireService(DiscordService).reconfigure({ accounts: resolvedAccounts });
  },
  configSchema: packageConfigSchema,
} satisfies TokenRingPlugin<typeof packageConfigSchema>;

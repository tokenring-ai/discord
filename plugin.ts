import {TokenRingPlugin} from "@tokenring-ai/app";
import {EscalationService} from "@tokenring-ai/escalation";
import {EscalationServiceConfigSchema} from "@tokenring-ai/escalation/schema";
import {z} from "zod";
import DiscordService from "./DiscordService.ts";
import {DiscordEscalationProvider} from "./index.ts";
import packageJSON from './package.json' with {type: 'json'};
import {DiscordEscalationProviderConfigSchema, DiscordServiceConfigSchema} from "./schema.ts";

const packageConfigSchema = z.object({
  discord: DiscordServiceConfigSchema.optional(),
  escalation: EscalationServiceConfigSchema.optional()
});

export default {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  install(app, config) {
    if (config.discord) {
      app.addServices(new DiscordService(app, config.discord));
      if (config.escalation) {
        app.waitForService(EscalationService, escalationService => {
          for (const [providerName, provider] of Object.entries(config.escalation!.providers)) {
            if ((provider as {type?: string}).type === "discord") {
              escalationService.registerProvider(providerName, new DiscordEscalationProvider(DiscordEscalationProviderConfigSchema.parse(provider)));
            }
          }
        });
      }
    }
  },
  config: packageConfigSchema
} satisfies TokenRingPlugin<typeof packageConfigSchema>;

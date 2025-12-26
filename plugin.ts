import {TokenRingPlugin} from "@tokenring-ai/app";
import {z} from "zod";
import DiscordService, {DiscordServiceConfigSchema} from "./DiscordService.ts";
import packageJSON from './package.json' with {type: 'json'};

const packageConfigSchema = z.object({
  discord: DiscordServiceConfigSchema.optional(),
});

export default {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  install(app, config) {
    const discordConfig = app.getConfigSlice("discord", DiscordServiceConfigSchema.optional());

    if (discordConfig) {
      app.addServices(new DiscordService(app, discordConfig));
    }
  },
  config: packageConfigSchema
} satisfies TokenRingPlugin<typeof packageConfigSchema>;

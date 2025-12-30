import {TokenRingPlugin} from "@tokenring-ai/app";
import {z} from "zod";
import DiscordService, {DiscordServiceConfigSchema} from "./DiscordService.ts";
import packageJSON from './package.json' with {type: 'json'};

const packageConfigSchema = z.object({
  discord: DiscordServiceConfigSchema.optional(),
}).default({});

export default {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  install(app, config) {
    if (config.discord) {
      app.addServices(new DiscordService(app, config.discord));
    }
  },
  config: packageConfigSchema
} satisfies TokenRingPlugin<typeof packageConfigSchema>;

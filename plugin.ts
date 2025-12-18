import TokenRingApp from "@tokenring-ai/app";
import {TokenRingPlugin} from "@tokenring-ai/app";
import packageJSON from './package.json' with {type: 'json'};
import DiscordService, {DiscordServiceConfigSchema} from "./DiscordService.ts";


export default {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  install(app: TokenRingApp) {
    const discordConfig = app.getConfigSlice("discord", DiscordServiceConfigSchema.optional());

    if (discordConfig) {
      app.addServices(new DiscordService(app, discordConfig));
    }
  },
} satisfies TokenRingPlugin;

import type { ConfigFieldMeta } from "@tokenring-ai/app/config/metadata";
import { secret, type WithResolvedSecrets } from "@tokenring-ai/secrets/secret";
import z from "zod";

/**
 * A Discord application account. Agent behavior, channels, users, and join
 * messages belong to the bot plugin; this package only configures transports.
 */
export const DiscordAccountConfigSchema = z.object({
  botToken: secret({ description: "Discord bot token" }),
  maxFileSize: z
    .number()
    .default(20_971_520)
    .meta({ advanced: true, description: "Largest file, in bytes, fetched from Discord" } satisfies ConfigFieldMeta),
});

export type ParsedDiscordAccountConfig = z.output<typeof DiscordAccountConfigSchema>;
export type ResolvedDiscordAccountConfig = WithResolvedSecrets<ParsedDiscordAccountConfig, "botToken">;

export const DiscordServiceConfigSchema = z
  .object({
    accounts: z
      .record(z.string(), DiscordAccountConfigSchema)
      .default({})
      .meta({ label: "Accounts", description: "Discord applications, keyed by the service name bots address them by" } satisfies ConfigFieldMeta),
  })
  .meta({ label: "Discord", description: "Discord application accounts" } satisfies ConfigFieldMeta);

export type ParsedDiscordServiceConfig = z.output<typeof DiscordServiceConfigSchema>;
export type ResolvedDiscordServiceConfig = { accounts: Record<string, ResolvedDiscordAccountConfig> };

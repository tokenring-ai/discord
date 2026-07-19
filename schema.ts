import type { ConfigFieldMeta } from "@tokenring-ai/app/config/metadata";
import z from "zod";

export const DiscordEscalationBotConfigSchema = z.object({
  channel: z.string().meta({ description: "Channel ID escalations are posted to" } satisfies ConfigFieldMeta),
});

export const DiscordBotConfigSchema = z.object({
  name: z.string().meta({ description: "Display name for this bot" } satisfies ConfigFieldMeta),
  botToken: z
    .string()
    .min(1, "Bot token is required")
    .meta({ sensitive: true, description: "Discord bot token" } satisfies ConfigFieldMeta),
  joinMessage: z
    .string()
    .exactOptional()
    .meta({ uiType: "multilineText", advanced: true, description: "Message posted when the bot joins a server" } satisfies ConfigFieldMeta),
  maxFileSize: z
    .number()
    .default(20_971_520) // 20MB default
    .meta({ unit: "bytes", advanced: true, description: "Maximum size of file attachments the bot will send" } satisfies ConfigFieldMeta),
  channels: z
    .record(
      z.string(),
      z.object({
        channelId: z.string().meta({ description: "Discord channel ID" } satisfies ConfigFieldMeta),
        allowedUsers: z
          .array(z.string())
          .default([])
          .meta({ description: "User IDs allowed to interact with the bot in this channel (empty allows everyone)" } satisfies ConfigFieldMeta),
        agentType: z.string().meta({ description: "Agent type spawned to handle messages in this channel" } satisfies ConfigFieldMeta),
      }),
    )
    .meta({ label: "Channels", description: "Channel-specific bot behavior, keyed by name" } satisfies ConfigFieldMeta),
  dmAgentType: z
    .string()
    .exactOptional()
    .meta({ description: "Agent type spawned to handle direct messages" } satisfies ConfigFieldMeta),
  dmAllowedUsers: z
    .array(z.string())
    .default([])
    .meta({ description: "User IDs allowed to DM the bot (empty allows everyone)" } satisfies ConfigFieldMeta),
  escalation: DiscordEscalationBotConfigSchema.exactOptional().meta({ label: "Escalation", advanced: true } satisfies ConfigFieldMeta),
});

export type ParsedDiscordBotConfig = z.output<typeof DiscordBotConfigSchema>;

export const DiscordServiceConfigSchema = z
  .object({
    bots: z
      .record(z.string(), DiscordBotConfigSchema)
      .default({})
      .meta({ label: "Bots", description: "Discord bots, keyed by name" } satisfies ConfigFieldMeta),
  })
  .meta({ label: "Discord", description: "Discord bot integration settings" } satisfies ConfigFieldMeta);
export type ParsedDiscordServiceConfig = z.output<typeof DiscordServiceConfigSchema>;

export const DiscordEscalationProviderConfigSchema = z.object({
  type: z.literal("discord"),
  bot: z.string().meta({ description: "Name of the Discord bot used for escalation" } satisfies ConfigFieldMeta),
  channel: z.string().meta({ description: "Channel ID escalations are posted to" } satisfies ConfigFieldMeta),
});

export type ParsedDiscordEscalationProviderConfig = z.output<typeof DiscordEscalationProviderConfigSchema>;
export type ParsedDiscordEscalationBotConfig = z.output<typeof DiscordEscalationBotConfigSchema>;

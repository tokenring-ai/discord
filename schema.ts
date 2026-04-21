import z from "zod";

export const DiscordEscalationBotConfigSchema = z.object({
  channel: z.string(),
});

export const DiscordBotConfigSchema = z.object({
  name: z.string(),
  botToken: z.string().min(1, "Bot token is required"),
  joinMessage: z.string().exactOptional(),
  maxFileSize: z.number().default(20_971_520), // 20MB default
  channels: z.record(
    z.string(),
    z.object({
      channelId: z.string(),
      allowedUsers: z.array(z.string()).default([]),
      agentType: z.string(),
    }),
  ),
  dmAgentType: z.string().exactOptional(),
  dmAllowedUsers: z.array(z.string()).default([]),
  escalation: DiscordEscalationBotConfigSchema.exactOptional(),
});

export type ParsedDiscordBotConfig = z.output<typeof DiscordBotConfigSchema>;

export const DiscordServiceConfigSchema = z.object({
  bots: z.record(z.string(), DiscordBotConfigSchema).default({}),
});
export type ParsedDiscordServiceConfig = z.output<typeof DiscordServiceConfigSchema>;

export const DiscordEscalationProviderConfigSchema = z.object({
  type: z.literal("discord"),
  bot: z.string(),
  channel: z.string(),
});

export type ParsedDiscordEscalationProviderConfig = z.output<typeof DiscordEscalationProviderConfigSchema>;
export type ParsedDiscordEscalationBotConfig = z.output<typeof DiscordEscalationBotConfigSchema>;

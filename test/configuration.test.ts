import { describe, expect, it } from "vitest";

import { DiscordBotConfigSchema, DiscordEscalationProviderConfigSchema, DiscordServiceConfigSchema, type ParsedDiscordServiceConfig } from "../schema";

describe("Discord Service Configuration", () => {
  it("validates a complete multi-bot config", () => {
    const validConfig = {
      bots: {
        primary: {
          name: "Primary Bot",
          botToken: "valid-bot-token",
          joinMessage: "Discord bot is online!",
          channels: {
            dev: {
              channelId: "123456789",
              allowedUsers: ["111111111", "222222222"],
              agentType: "leader"
            }
          },
          dmAgentType: "personalAgent",
          dmAllowedUsers: ["111111111"]
        }
      }
    };

    const result = DiscordServiceConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        ...validConfig,
        bots: {
          ...validConfig.bots,
          primary: {
            ...validConfig.bots.primary,
            maxFileSize: 20_971_520,
          }
        }
      });
    }
  });

  it("applies defaults for optional bot fields", () => {
    const result = DiscordBotConfigSchema.parse({
      name: "Default Bot",
      botToken: "token",
      channels: {
        ops: {
          channelId: "987654321",
          agentType: "teamLeader"
        }
      }
    });

    expect(result.maxFileSize).toBe(20_971_520);
    expect(result.channels.ops!.allowedUsers).toEqual([]);
    expect(result.dmAllowedUsers).toEqual([]);
    expect(result.dmAgentType).toBeUndefined();
  });

  it("infers parsed config type from schema output", () => {
    const config: ParsedDiscordServiceConfig = {
      bots: {
        default: {
          name: "Default Bot",
          botToken: "token",
          maxFileSize: 1024,
          channels: {
            support: {
              channelId: "123",
              allowedUsers: [],
              agentType: "supportAgent"
            }
          },
          dmAllowedUsers: []
        }
      }
    };

    expect(config.bots.default!.channels.support!.channelId).toBe("123");
  });

  it("validates escalation provider config", () => {
    const providerConfig = {
      type: "discord",
      bot: "primary",
      channel: "admins"
    };

    const result = DiscordEscalationProviderConfigSchema.safeParse(providerConfig);
    expect(result.success).toBe(true);
  });
});

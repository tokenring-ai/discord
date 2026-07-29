import { describe, expect, it } from "bun:test";
import { DiscordAccountConfigSchema, DiscordServiceConfigSchema, type ParsedDiscordServiceConfig } from "../schema.ts";

describe("Discord service configuration", () => {
  it("validates multiple application accounts", () => {
    const result = DiscordServiceConfigSchema.safeParse({
      accounts: {
        primary: { botToken: "primary-token" },
        support: { botToken: "support-token", maxFileSize: 1024 },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.accounts.primary!.maxFileSize).toBe(20_971_520);
      expect(result.data.accounts.support!.maxFileSize).toBe(1024);
    }
  });

  it("defaults to no accounts", () => {
    expect(DiscordServiceConfigSchema.parse({})).toEqual({ accounts: {} });
  });

  it("applies the account defaults", () => {
    expect(DiscordAccountConfigSchema.parse({ botToken: "token" })).toEqual({
      botToken: "token",
      maxFileSize: 20_971_520,
    });
  });

  it("infers parsed config type from schema output", () => {
    const config: ParsedDiscordServiceConfig = {
      accounts: {
        default: {
          botToken: "token",
          maxFileSize: 1024,
        },
      },
    };

    expect(config.accounts.default!.maxFileSize).toBe(1024);
  });
});

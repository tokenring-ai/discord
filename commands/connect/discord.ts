import { CommandFailedError } from "@tokenring-ai/agent/AgentError";
import type { AgentCommandInputSchema, AgentCommandInputType, TokenRingAgentCommand } from "@tokenring-ai/agent/types";
import { type ConfigLayer, ConfigurationService } from "@tokenring-ai/app";

const inputSchema = {
  args: {
    name: {
      description: "The name to save the Discord account under",
      type: "string",
      defaultValue: "discord",
    },
    save: {
      description: "Where to save the Discord account configuration",
      type: "enum",
      values: ["user", "project"],
      defaultValue: "user",
    },
  },
  positionals: [
    {
      name: "botToken",
      description: "The Discord application bot token",
      required: false,
    },
  ],
} as const satisfies AgentCommandInputSchema;

export default {
  name: "connect discord",
  alias: "discord connect",
  description: "Connects a Discord application account",
  inputSchema,
  execute: async ({ agent, args: { botToken, name, save } }: AgentCommandInputType<typeof inputSchema>): Promise<string> => {
    if (!agent.headless && !botToken) {
      botToken =
        (await agent.askForText({
          message: "What is the bot token for the Discord application you want to connect?",
          label: "Bot Token",
          masked: true,
        })) ?? undefined;
    }

    if (!botToken) throw new CommandFailedError("Usage: /connect discord <botToken>");

    const configService = agent.requireService(ConfigurationService);
    const overrides = configService.getOverrides(save);
    const discord = (overrides.discord ?? {}) as { accounts?: Record<string, unknown> };
    const accounts = discord.accounts ?? {};
    const existingAccount = (accounts[name] ?? {}) as Record<string, unknown>;
    const next = {
      ...overrides,
      discord: {
        ...discord,
        accounts: {
          ...accounts,
          [name]: {
            ...existingAccount,
            botToken,
          },
        },
      },
    } satisfies ConfigLayer;

    const result = await configService.apply(save, next);
    if (!result.ok) {
      throw new CommandFailedError(result.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("\n"));
    }

    return `Discord account "${name}" connected.`;
  },
  help: `Connect a Discord application account and save its token in the configuration.

When run interactively, the token is requested using a masked prompt.

## Example

/connect discord --name=discord`,
} satisfies TokenRingAgentCommand<typeof inputSchema>;

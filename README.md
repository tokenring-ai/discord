# @tokenring-ai/discord

A TokenRing plugin providing Discord bot integration for AI-powered agent
interactions through Discord. This package enables multiple Discord bots to
communicate with TokenRing agents, supporting both guild channels and direct
messages with per-user/channel authorization and persistent agent context.

## Overview

The `@tokenring-ai/discord` package provides comprehensive Discord integration
that allows TokenRing agents to interact with users through Discord. It
supports:

- **Multi-bot architecture**: Run multiple Discord bots with independent
  configurations
- **Channel-based routing**: Configure specific agents for different Discord
  channels
- **Direct message support**: Enable DM interactions with optional user
  authorization
- **Persistent agent context**: Each channel maintains its own agent instance
- **Buffered streaming**: Intelligent message chunking and editing for long
  responses
- **Attachment handling**: Process file attachments with configurable size
  limits
- **Escalation integration**: Built-in support for escalation workflows via
  Discord

## Installation

```bash
bun add @tokenring-ai/discord
```

### Dependencies

This package requires the following dependencies:

- `@tokenring-ai/app` (workspace:*) - Base application framework
- `@tokenring-ai/agent` (workspace:*) - Agent management and event handling
- `@tokenring-ai/utility` (workspace:*) - Shared utilities and helpers
- `@tokenring-ai/escalation` (workspace:*) - Escalation service and provider
  interface
- `discord.js` (^14.26.4) - Discord API client library
- `zod` (^4.4.3) - Schema validation

## Features

- **Multi-bot support**: Configure and run multiple Discord bots simultaneously
- **Channel-based configuration**: Route messages to specific agent types per
  channel
- **Direct message support**: Enable DM interactions with configurable user
  authorization
- **Per-channel agent isolation**: Each channel maintains persistent agent
  context
- **Buffered streaming responses**: Intelligent message chunking with 250ms
  rate limiting
- **Message editing**: Update existing messages instead of creating new ones
- **Attachment ingestion**: Download and process file attachments (configurable
  size limits)
- **Reply-tracked communication**: Track user replies to bot messages for
  escalation workflows
- **Escalation provider integration**: Built-in `DiscordEscalationProvider`
  for admin communications
- **Graceful shutdown**: Clean agent cleanup and bot disconnection
- **Authorization controls**: Per-channel and per-user access restrictions
- **Join announcements**: Optional welcome messages when bots join channels

## Chat Commands

The Discord plugin does not define traditional slash commands. Instead, it
processes messages through Discord's native messaging system. All message
processing is handled automatically by the Discord bots based on channel
configuration and user authorization.

### Message Processing Patterns

**Guild Channel Messages:**

- Bot must be mentioned to trigger processing (e.g., `@BotName what is the
  weather?`)
- Mention is stripped from the message content before processing
- Message is routed to the channel's configured agent type
- Empty messages with no attachments are ignored

**Agent Input Format:**

Messages are converted to agent input with the following format:

```text
/chat send From: {displayName}, Username: (@{username}) {message text}
```

For example, a message from user "John Doe" (@johndoe) saying "hello" becomes:

```text
/chat send From: John Doe, Username: (@johndoe) hello
```

If no text is sent (only attachments), the message text is replaced with
"No text sent".

**Direct Messages:**

- Any message to the bot is processed (if DMs are enabled via `dmAgentType`)
- No mention required
- Message content and attachments are processed by the DM agent

**Reply Messages:**

- Replies to bot messages are tracked for escalation workflows
- Reply content is sent back to the agent as user input
- Reply tracking enables multi-turn conversations and escalation scenarios

### Authorization Patterns

**Channel Authorization:**

- `allowedUsers: string[]` - Empty array allows all users in the guild
- Non-empty array restricts access to specified Discord user IDs
- Unauthorized users receive: "Sorry, you are not authorized."
- Authorization is checked before message processing

**DM Authorization:**

- `dmAllowedUsers: string[]` - Empty array allows all users (if `dmAgentType`
  is configured)
- Non-empty array restricts DM access to specified Discord user IDs
- Unauthorized users receive: "Sorry, you are not authorized to DM this bot."
- DMs are disabled entirely if `dmAgentType` is not configured

## Tools

The Discord package does not define any tools. Communication is handled through
Discord's native messaging system. The package provides the following
capabilities through its service architecture:

- **Bot Management**: Start, stop, and manage multiple Discord bots via
  `DiscordService`
- **Communication Channels**: Create tracked communication channels for
  escalation workflows
- **Attachment Processing**: Automatically download and process file
  attachments
- **Agent Spawning**: Automatic agent creation per channel with persistent
  context

## Configuration

### Configuration Schemas

#### DiscordEscalationBotConfigSchema

Configuration for escalation settings within a bot.

```typescript
export const DiscordEscalationBotConfigSchema = z.object({
  channel: z.string(),
});
```

| Property  | Type   | Required | Description                        |
|-----------|--------|----------|------------------------------------|
| `channel` | string | Yes      | Name of the channel for escalation |

#### DiscordBotConfigSchema

Configuration for a single Discord bot instance.

```typescript
export const DiscordBotConfigSchema = z.object({
  name: z.string(),
  botToken: z.string().min(1, "Bot token is required"),
  joinMessage: z.string().exactOptional(),
  maxFileSize: z.number().default(20_971_520),
  channels: z.record(z.string(), z.object({
    channelId: z.string(),
    allowedUsers: z.array(z.string()).default([]),
    agentType: z.string(),
  })),
  dmAgentType: z.string().exactOptional(),
  dmAllowedUsers: z.array(z.string()).default([]),
  escalation: DiscordEscalationBotConfigSchema.exactOptional(),
});
```

| Property         | Type     | Required | Default         | Description                           |
|------------------|----------|----------|-----------------|---------------------------------------|
| `name`           | string   | Yes      | -               | Display name for the bot              |
| `botToken`       | string   | Yes      | -               | Discord bot token                     |
| `joinMessage`    | string   | No       | -               | Message sent when bot joins a channel |
| `maxFileSize`    | number   | No       | 20971520 (20MB) | Maximum attachment size in bytes      |
| `channels`       | Record   | Yes      | -               | Channel configurations                |
| `dmAgentType`    | string   | No       | -               | Agent type for DM interactions        |
| `dmAllowedUsers` | string[] | No       | []              | Authorized user IDs for DMs           |
| `escalation`     | Object   | No       | -               | Escalation configuration              |

#### Channel Configuration

```typescript
{
  channelId: string,
  allowedUsers: string[],
  agentType: string
}
```

| Property       | Type     | Required | Default | Description                             |
|----------------|----------|----------|---------|-----------------------------------------|
| `channelId`    | string   | Yes      | -       | Discord channel ID                      |
| `allowedUsers` | string[] | No       | []      | Authorized user IDs (empty = all users) |
| `agentType`    | string   | Yes      | -       | Type of agent to use for this channel   |

#### DiscordServiceConfigSchema

Configuration for the Discord service.

```typescript
export const DiscordServiceConfigSchema = z.object({
  bots: z.record(z.string(), DiscordBotConfigSchema).default({}),
});
```

| Property | Type                             | Required | Description                        |
|----------|----------------------------------|----------|------------------------------------|
| `bots`   | Record<string, DiscordBotConfig> | No       | Map of bot names to configurations |

#### DiscordEscalationProviderConfigSchema

Configuration for the Discord escalation provider.

```typescript
export const DiscordEscalationProviderConfigSchema = z.object({
  type: z.literal("discord"),
  bot: z.string(),
  channel: z.string(),
});
```

| Property  | Type      | Required | Description                       |
|-----------|-----------|----------|-----------------------------------|
| `type`    | "discord" | Yes      | Provider type identifier          |
| `bot`     | string    | Yes      | Name of the bot to use            |
| `channel` | string    | Yes      | Name of the channel configuration |

### Full Configuration Example

```yaml
discord:
  bots:
    primary:
      name: "Primary Bot"
      botToken: "${DISCORD_BOT_TOKEN}"
      joinMessage: "Discord bot is online and ready!"
      maxFileSize: 20971520
      channels:
        engineering:
          channelId: "123456789012345678"
          allowedUsers: []
          agentType: "teamLeader"
        support:
          channelId: "987654321098765432"
          allowedUsers:
            - "111111111111111111"
            - "222222222222222222"
          agentType: "supportAgent"
      dmAgentType: "personalAgent"
      dmAllowedUsers:
        - "111111111111111111"
      escalation:
        channel: "engineering"
```

### Environment Variable Configuration

The plugin supports automatic bot creation from environment variables:

```bash
# Single bot
DISCORD_BOT_TOKEN=your-bot-token
DISCORD_BOT_NAME=My Bot
DISCORD_ESCALATION_CHANNEL=admin-channel

# Multiple bots (numbered)
DISCORD_BOT_TOKEN1=token-for-bot-1
DISCORD_BOT_NAME1=Bot One
DISCORD_ESCALATION_CHANNEL1=channel-1

DISCORD_BOT_TOKEN2=token-for-bot-2
DISCORD_BOT_NAME2=Bot Two
DISCORD_ESCALATION_CHANNEL2=channel-2
```

When using environment variables:

- `DISCORD_BOT_TOKEN` or `DISCORD_BOT_TOKEN{n}`: Required bot token
- `DISCORD_BOT_NAME` or `DISCORD_BOT_NAME{n}`: Optional bot name, defaults to
  `Discord Bot` (no suffix) or `Discord Bot {n}` (with numeric suffix)
- `DISCORD_ESCALATION_CHANNEL` or `DISCORD_ESCALATION_CHANNEL{n}`: Optional
  escalation channel name

If no bots are configured (neither via config nor environment variables), the
plugin installs nothing and returns early.

## Usage Examples

### Basic Configuration

```typescript
import TokenRingApp from "@tokenring-ai/app";
import discordPlugin from "@tokenring-ai/discord/plugin";

const config = {
  discord: {
    bots: {
      primary: {
        name: "Primary Bot",
        botToken: process.env.DISCORD_BOT_TOKEN!,
        joinMessage: "Discord bot is online and ready!",
        maxFileSize: 20_971_520,
        channels: {
          engineering: {
            channelId: "123456789012345678",
            allowedUsers: [],
            agentType: "teamLeader"
          },
          support: {
            channelId: "987654321098765432",
            allowedUsers: ["111111111111111111", "222222222222222222"],
            agentType: "supportAgent"
          }
        },
        dmAgentType: "personalAgent",
        dmAllowedUsers: ["111111111111111111"]
      }
    }
  }
};

const app = new TokenRingApp();
await app.installPlugin(discordPlugin, config);
```

### Direct Message Setup

```typescript
const config = {
  discord: {
    bots: {
      main: {
        name: "Main Bot",
        botToken: process.env.DISCORD_BOT_TOKEN!,
        channels: {
          general: {
            channelId: "123456789012345678",
            allowedUsers: [],
            agentType: "teamLeader"
          }
        },
        // Enable DMs with specific users
        dmAgentType: "personalAgent",
        dmAllowedUsers: [
          "111111111111111111", // Admin user ID
          "222222222222222222"  // Another authorized user
        ]
      }
    }
  }
};
```

### Escalation Integration

```typescript
const config = {
  discord: {
    bots: {
      adminBot: {
        name: "Admin Bot",
        botToken: process.env.DISCORD_BOT_TOKEN!,
        channels: {
          adminChannel: {
            channelId: "123456789012345678",
            allowedUsers: ["111111111111111111"],
            agentType: "adminAgent"
          }
        },
        escalation: {
          channel: "adminChannel"
        }
      }
    }
  }
};
```

### Programmatic Service Registration

```typescript
import TokenRingApp from "@tokenring-ai/app";
import DiscordService from "@tokenring-ai/discord/DiscordService";
import { DiscordEscalationProvider } from "@tokenring-ai/discord";
import { EscalationService } from "@tokenring-ai/escalation";

const app = new TokenRingApp();

// Register Discord service directly
const discordService = new DiscordService(app, {
  bots: {
    primary: {
      name: "Primary Bot",
      botToken: process.env.DISCORD_BOT_TOKEN!,
      channels: {
        general: {
          channelId: "123456789012345678",
          allowedUsers: [],
          agentType: "teamLeader"
        }
      }
    }
  }
});

app.addServices(discordService);

// Register escalation provider
app.waitForService(EscalationService, (escalationService) => {
  escalationService.registerProvider(
    "discordAdmins",
    new DiscordEscalationProvider({
      type: "discord",
      bot: "primary",
      channel: "general"
    })
  );
});
```

## Integration

### Plugin Registration

The package provides a TokenRing plugin that automatically registers services:

```typescript
import discordPlugin from "@tokenring-ai/discord/plugin";

const app = new TokenRingApp();
await app.installPlugin(discordPlugin, {
  discord: {
    bots: {
      primary: {
        name: "Primary Bot",
        botToken: process.env.DISCORD_BOT_TOKEN!,
        channels: {
          general: {
            channelId: "123456789012345678",
            allowedUsers: [],
            agentType: "teamLeader"
          }
        }
      }
    }
  }
});
```

### Service Registration

The plugin automatically registers:

- **DiscordService**: Manages multiple Discord bot instances via `KeyedRegistry`
- **DiscordEscalationProvider**: Registered with `EscalationService` for bots
  with `escalation` configuration

### Plugin Install Behavior

The plugin's `install` function:

1. Calls `addBotsFromEnv()` to merge environment variable configurations into
   the bots record using `stripUndefinedKeys` from `@tokenring-ai/utility`
2. If no bots are configured (neither via config nor environment variables),
   returns early without installing any services
3. Registers `DiscordService` with the app
4. Waits for `EscalationService` and registers `DiscordEscalationProvider` for
   each bot that has escalation configured

### Exports

The package exports the following components:

```typescript
// Services
export { default as DiscordService } from "./DiscordService.ts";
export { default as DiscordBotService } from "./DiscordService.ts"; // Alias

// Escalation Provider
export { default as DiscordEscalationProvider } from "./DiscordEscalationProvider.ts";

// Schemas and Types
export {
  DiscordBotConfigSchema,
  DiscordServiceConfigSchema,
  DiscordEscalationProviderConfigSchema,
} from "./schema.ts";

export type {
  ParsedDiscordBotConfig,
  ParsedDiscordServiceConfig,
  ParsedDiscordEscalationProviderConfig,
  ParsedDiscordEscalationBotConfig,
} from "./schema.ts";
```

**Note**: `DiscordBotService` is an alias for `DiscordService` - both refer to
the same class.

### Agent Integration

Each Discord channel maintains its own agent instance:

- Agents are spawned on first message to a channel with `headless: true`
- Agent context persists for the channel's lifetime
- Background event loops process agent outputs via `subscribeStateAsync`
- Agents are cleaned up on bot shutdown

### Event Handling

The package handles Discord events:

- `messageCreate`: Processes incoming messages
- Bot mentions trigger agent interactions in guild channels
- Direct messages are handled separately
- Reply tracking enables escalation workflows

### Gateway Intents

The Discord client uses the following Gateway Intents:

```typescript
GatewayIntentBits.Guilds,         // Server/guild operations
GatewayIntentBits.GuildMessages,  // Guild message events
GatewayIntentBits.MessageContent, // Message content access
GatewayIntentBits.DirectMessages  // Direct message events
```

### Integration State Management

- Each channel maintains a `ChatResponse` buffer
- Messages are tracked by Discord message ID
- User channels track reply messages for escalation
- State is cleaned up on bot shutdown

## Core Components/API

### DiscordService

The main service that manages multiple Discord bot instances.

**Class**: `DiscordService implements TokenRingService`

**Properties**:

- `name: string` - Service name ("DiscordService")
- `description: string` - Service description ("Manages multiple Discord bots
  for interacting with TokenRing agents.")

**Methods**:

- `getAvailableBots(): string[]` - Returns array of registered bot names
  (delegates to `KeyedRegistry.keysArray`)
- `getBot(botName: string): DiscordBot | undefined` - Returns a specific bot
  instance (delegates to `KeyedRegistry.get`)
- `run(signal: AbortSignal): Promise<void>` - Starts all configured bots and
  handles shutdown via `waitForAbort`

**Constructor**:

```typescript
constructor(app: TokenRingApp, options: ParsedDiscordServiceConfig)
```

**Internal Implementation**:

- Uses `KeyedRegistry<DiscordBot>` to manage multiple `DiscordBot` instances
- Starts all configured bots sequentially on initialization
- Uses `waitForAbort` from `@tokenring-ai/utility` for graceful shutdown
- Handles graceful shutdown by stopping all bots and unregistering them

### DiscordBot

Handles individual bot operations including message processing, agent
management, and communication.

**Class**: `DiscordBot`

**Constructor**:

```typescript
constructor(
  app: TokenRingApp,
  discordService: DiscordService,
  botName: string,
  botConfig: ParsedDiscordBotConfig
)
```

**Properties**:

- `botName: string` - The name of this bot instance
- `botConfig: ParsedDiscordBotConfig` - Configuration for this bot
- `client: Client` - Discord.js client instance (initialized in start())
- `botUserId: string | undefined` - Discord user ID of the bot

**Public Methods**:

- `start(): Promise<void>` - Initializes and starts the Discord bot
- `stop(): Promise<void>` - Stops the bot and cleans up resources (flushes
  pending buffers, clears all state, deletes agents via `AgentManager`,
  destroys client)
- `getBotUserId(): string | undefined` - Returns the Discord user ID of the
  bot
- `createCommunicationChannelWithChannel(channelName: string):
  CommunicationChannel` - Creates a communication channel for escalation
- `createCommunicationChannelWithUser(userId: string): CommunicationChannel` -
  Creates a DM communication channel

**Private Methods**:

- `handleMessage(message: Message): Promise<void>` - Processes incoming
  Discord messages, routing to DM or channel handlers; strips bot mentions,
  constructs agent input as `/chat send From: {displayName}, Username:
  (@{username}) {text}`, waits for agent idle state before sending input
- `handleDirectMessage(message, userId, channelId, text): Promise<void>` -
  Handles DM messages with authorization checks; replies with "DMs are not
  enabled for this bot." if `dmAgentType` is not configured and the message
  has content
- `extractAllAttachments(message: Message): Promise<InputAttachment[]>` -
  Downloads and processes file attachments, converting to base64; validates
  MIME type via `BaseAttachmentSchema`; skips attachments exceeding
  `maxFileSize`; includes timestamp in attachment metadata
- `ensureAgentForChannel(channelId, agentType): MaybePromise<Agent>` - Ensures
  an agent exists for a channel, spawns with `headless: true` if needed;
  starts background event loop for the channel
- `flushBuffer(channelId: string): Promise<void>` - Sends buffered messages to
  Discord, handles message editing and fallback; syncs from index 0 if
  response is complete, otherwise syncs only the last 2 chunks to reduce
  unnecessary edits; re-schedules on errors
- `sendMessage(channelId: string, text: string): Promise<string>` - Sends a
  message to a channel, returns message ID; tracks message ID to bot user ID
  mapping
- `updateMessageWithFallback(channelId, messageId, text): Promise<string>` -
  Updates existing message or creates new if not found (detects "unknown
  message" / error 10008)
- `agentEventLoop(channelId, agent, signal): Promise<void>` - Processes agent
  events for a channel via `subscribeStateAsync(AgentEventState)`; handles
  `output.chat`, `output.info` (prefixed `[INFO]:`), `output.warning`
  (prefixed `[WARNING]:`), `output.error` (prefixed `[ERROR]:`), and
  `agent.response` events
- `scheduleSend(): void` - Schedules message sending with 250ms rate limiting
- `processPending(): Promise<void>` - Processes all pending channel buffers
  with `isProcessing` guard to prevent concurrent processing
- `fetchTextChannel(channelId: string): Promise<MessageCapableChannel>` -
  Fetches and validates text channel
- `createTrackedChannel(destinationId, sendFn): CommunicationChannel` -
  Creates a tracked communication channel for escalation with reply tracking
  and async dispose cleanup
- `handleChatOutput(channelId, content): void` - Handles chat output from
  agent, accumulates in buffer
- `isMessageNotFoundError(error): boolean` - Checks if error is a Discord
  "unknown message" error

**Key Features**:

- **Message buffering**: Accumulates agent output and sends in chunks with
  250ms rate limiting
- **Rate limiting**: Automatic 250ms delay between messages to respect Discord
  API limits
- **Message editing**: Attempts to update existing messages before creating
  new ones
- **Reply tracking**: Tracks user replies to bot messages for escalation
  workflows
- **Attachment processing**: Downloads and converts attachments to base64 for
  agent processing
- **Agent per channel**: Each Discord channel maintains its own persistent
  agent instance
- **Background event processing**: Agent events processed via background task
  with async state subscription
- **Graceful shutdown**: Clean buffer flushing and agent cleanup on bot stop
- **Sync optimization**: When response is incomplete, only syncs the last 2
  chunks to reduce unnecessary message edits

### DiscordEscalationProvider

Integration with the escalation system for admin communications via Discord.

**Class**: `DiscordEscalationProvider implements EscalationProvider`

**Constructor**:

```typescript
constructor(config: ParsedDiscordEscalationProviderConfig)
```

**Properties**:

- `config: ParsedDiscordEscalationProviderConfig` (readonly) - Provider
  configuration

**Methods**:

- `createCommunicationChannelWithUser(channelName: string, agent: Agent):
  CommunicationChannel` - Creates a communication channel for escalation

**Implementation**:

- Retrieves the configured bot from `DiscordService` using
  `agent.requireServiceByType(DiscordService)`
- Creates a communication channel for the specified channel configuration
- Enables escalation workflows through Discord

### splitIntoChunks

Utility function for splitting long messages into Discord-compatible chunks.

**Function**: `splitIntoChunks(text: string | null): string[]`

**Parameters**:

- `text: string | null` - The text to split

**Returns**: Array of message chunks (max 1990 characters each)

**Behavior**:

1. **Null/Empty Input**: Returns a single working message in the format
   `***{message}... ⏳***` where the message is randomly selected from
   `@tokenring-ai/utility/string/workingMessages` using `getRandomItem`
2. **Markdown-Aware Splitting**: First splits text at markdown headers (`\n#`)
   using a lookahead regex `/(?=\n#)/` to preserve header structure in chunks
3. **Character-Based Chunking**: Each section is then split into 1990-character
   chunks to respect Discord's message length limit
4. **Two-Phase Process**: Phase 1 splits at markdown headers to preserve
   formatting; Phase 2 splits remaining content at 1990-character boundaries

### Types

#### MessageCapableChannel

Type definition for Discord text channels that support message operations.

```typescript
type MessageCapableChannel = TextBasedChannel & {
  send: (content: string) => Promise<Message>;
  messages: {
    fetch: (id: string) => Promise<Message>;
  };
};
```

#### ChatResponse Type

Type for tracking chat response state per channel.

```typescript
type ChatResponse = {
  text: string | null;
  messageIds: (string | undefined)[];
  sentTexts: string[];
  isComplete?: boolean | undefined;
};
```

#### UserChannel Type

Type for tracking user communication channels for escalation.

```typescript
type UserChannel = {
  destinationId: string;
  trackedMessageIds: Set<string>;
  queue: string[];
  resolve?: ((value: IteratorResult<string>) => void) | undefined;
  closed: boolean;
};
```

#### Internal State Types

The DiscordBot class maintains several internal state structures:

```typescript
// Tracks active agent requests per channel
private activeRequests = new Map<string, { channelId: string; responseSent: boolean }>();

// Tracks channels with pending message buffers
private pendingChannelIds = new Set<string>();

// Tracks message IDs to bot user ID mapping
private messageIdToBotUserId = new Map<string, string>();

// Tracks event listeners per channel
private channelListeners = new Set<string>();

// Tracks per-channel chat responses
private chatResponses = new Map<string, ChatResponse>();

// Tracks per-channel agents
private channelAgents = new Map<string, Agent>();

// Tracks user channels for escalation
private userChannels = new Map<string, UserChannel>();

// Rate limiting state
private lastSendTime = 0;
private sendTimer: NodeJS.Timeout | null = null;
private isProcessing = false;
```

## State Management

### Per-Channel State

The DiscordBot maintains several state structures per channel:

#### ChatResponse State

Tracks accumulated agent output per channel:

- `text`: Accumulated response text (null initially, then string)
- `messageIds`: Discord message IDs for each chunk
- `sentTexts`: Previously sent text chunks for sync comparison
- `isComplete`: Whether the response is finished

#### UserChannel State

Tracks user communication for escalation:

- `destinationId`: Discord user/channel ID
- `trackedMessageIds`: Message IDs to track for replies
- `queue`: Buffered incoming messages
- `resolve`: Pending promise resolver
- `closed`: Channel closed state

### State Lifecycle

1. **Initialization**: State structures created when bot starts
2. **Per-channel setup**: Agent spawned with `headless: true`, event loop
   started on first message
3. **Active request tracking**: Request ID mapped to channel when input sent
4. **Response accumulation**: Chat output accumulated in `ChatResponse` buffer
5. **Buffer flushing**: Messages sent in chunks with rate limiting; when
   incomplete, only the last 2 chunks are synced to reduce edits
6. **Completion**: When agent response completes, full buffer flushed and
   state cleaned up (unless errors occurred, in which case re-scheduled)
7. **Shutdown**: All state cleared, agents deleted via `AgentManager`, bots
   stopped

### Cleanup Patterns

- `ChatResponse` deleted when response complete and no errors
- Pending channels re-scheduled if errors occur during flush
- User channels cleaned up on async dispose
- All state cleared on bot stop
- Agents deleted via `AgentManager` on shutdown

## RPC Endpoints

This package does not expose RPC endpoints. Communication is handled through
Discord's native messaging system.

## Testing

### Running Tests

```bash
cd pkg/discord
bun test
```

### Test Configuration

Tests use `vitest` for unit testing:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ["**/*.test.ts"],
    environment: "node",
    globals: true,
    isolate: true,
  },
});
```

### Example Test

```typescript
import { describe, expect, it } from "vitest";

import {
  DiscordBotConfigSchema,
  DiscordEscalationProviderConfigSchema,
  DiscordServiceConfigSchema,
  type ParsedDiscordServiceConfig
} from "../schema";

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
    expect(result.channels.ops.allowedUsers).toEqual([]);
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

    expect(config.bots.default.channels.support.channelId).toBe("123");
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
```

### Test File

The package includes a test file at `test/configuration.test.ts` for testing
configuration validation and schema parsing.

## Best Practices

### Bot Token Security

- Store tokens in environment variables (e.g., `DISCORD_BOT_TOKEN`)
- Never commit tokens to version control
- Use different tokens for development and production environments
- Rotate tokens periodically and revoke compromised tokens immediately

### Channel Authorization

- Use `allowedUsers` array to restrict channel access to specific user IDs
- Empty `allowedUsers` array allows all users in the guild
- Combine with Discord role-based permissions for layered security
- Regularly audit and update authorized user lists

### Message Rate Limiting

- The package implements automatic 250ms rate limiting between messages
- Large responses are automatically chunked to 1990 characters
- Message edits are preferred over new messages to reduce clutter
- Monitor for rate limit errors and adjust if needed

### Attachment Handling

- Set appropriate `maxFileSize` limits based on your use case (default: 20MB)
- Monitor attachment processing errors in service output
- Consider bandwidth implications for large file volumes
- Attachments exceeding size limit are skipped with error logging

### Agent Configuration

- Use distinct `agentType` values per channel for proper agent routing
- Configure appropriate agent capabilities per use case (e.g., support vs
  engineering)
- Monitor agent resource usage for high-traffic channels
- Each channel maintains its own persistent agent instance

### Escalation Setup

- Configure dedicated channels for escalation workflows
- Use specific bot instances for admin communications
- Test escalation workflows thoroughly before production use
- Ensure authorized users are properly configured for escalation channels

### Error Handling

- Monitor service output for bot initialization errors
- Handle attachment download failures gracefully
- Implement proper error logging for message send/update failures
- Use try-catch blocks when calling bot methods directly

### Performance Considerations

- Limit the number of concurrent channels per bot
- Monitor memory usage for high-traffic deployments
- Use separate bots for different environments (dev/prod)
- Consider rate limiting impact on high-volume channels

## Development

### Build

```bash
cd pkg/discord
bun run build
```

### Test

```bash
cd pkg/discord
bun run test
```

### Test Watch Mode

```bash
cd pkg/discord
bun run test:watch
```

### Test Coverage

```bash
cd pkg/discord
bun run test:coverage
```

### Package Structure

```text
pkg/discord/
├── DiscordBot.ts                    # Individual bot implementation
├── DiscordEscalationProvider.ts     # Escalation provider implementation
├── DiscordService.ts                # Service managing multiple bots
├── index.ts                         # Public exports
├── plugin.ts                        # TokenRing plugin definition
├── schema.ts                        # Zod schemas and types
├── splitIntoChunks.ts               # Message chunking utility
├── package.json                     # Package metadata and dependencies
├── vitest.config.ts                 # Test configuration
└── test/
    └── configuration.test.ts        # Configuration validation tests
```

## License

MIT License - see LICENSE file for details.

---

## Related Components

- `@tokenring-ai/escalation`: Escalation service and provider interface
- `@tokenring-ai/agent`: Agent management and event handling
- `@tokenring-ai/app`: Base application framework
- `@tokenring-ai/utility`: Shared utilities and helpers
- `discord.js`: Discord API client library

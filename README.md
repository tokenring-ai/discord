# @tokenring-ai/discord

A TokenRing plugin providing Discord bot integration for AI-powered agent interactions through Discord. This package enables multiple Discord bots to communicate with TokenRing agents, supporting both guild channels and direct messages with per-user/channel authorization and persistent agent context.

## Overview

The `@tokenring-ai/discord` package provides comprehensive Discord integration that allows TokenRing agents to interact with users through Discord. It supports:

- **Multi-bot architecture**: Run multiple Discord bots with independent configurations
- **Channel-based routing**: Configure specific agents for different Discord channels
- **Direct message support**: Enable DM interactions with optional user authorization
- **Persistent agent context**: Each channel maintains its own agent instance
- **Buffered streaming**: Intelligent message chunking and editing for long responses
- **Attachment handling**: Process file attachments with configurable size limits
- **Escalation integration**: Built-in support for escalation workflows via Discord

## Installation

```bash
bun add @tokenring-ai/discord
```

### Dependencies

This package requires the following dependencies:

- `@tokenring-ai/app` (0.2.0) - Base application framework
- `@tokenring-ai/chat` (0.2.0) - Chat service for agent interactions
- `@tokenring-ai/agent` (0.2.0) - Agent management and event handling
- `@tokenring-ai/utility` (0.2.0) - Shared utilities and helpers
- `@tokenring-ai/escalation` (0.2.0) - Escalation service and provider interface
- `discord.js` (^14.25.1) - Discord API client library
- `axios` (^1.13.6) - HTTP client for attachment downloads
- `zod` (^4.3.6) - Schema validation

## Features

- **Multi-bot support**: Configure and run multiple Discord bots simultaneously
- **Channel-based configuration**: Route messages to specific agent types per channel
- **Direct message support**: Enable DM interactions with configurable user authorization
- **Per-channel agent isolation**: Each channel maintains persistent agent context
- **Buffered streaming responses**: Intelligent message chunking with 250ms rate limiting
- **Message editing**: Update existing messages instead of creating new ones
- **Attachment ingestion**: Download and process file attachments (configurable size limits)
- **Reply-tracked communication**: Track user replies to bot messages for escalation workflows
- **Escalation provider integration**: Built-in `DiscordEscalationProvider` for admin communications
- **Graceful shutdown**: Clean agent cleanup and bot disconnection
- **Authorization controls**: Per-channel and per-user access restrictions
- **Join announcements**: Optional welcome messages when bots join channels

## Core Components/API

### DiscordService

The main service that manages multiple Discord bot instances.

**Class**: `DiscordService implements TokenRingService`

**Properties**:
- `name: string` - Service name ("DiscordService")
- `description: string` - Service description ("Manages multiple Discord bots for interacting with TokenRing agents.")

**Methods**:
- `getAvailableBots(): string[]` - Returns array of registered bot names
- `getBot(botName: string): DiscordBot | undefined` - Returns a specific bot instance
- `run(signal: AbortSignal): Promise<void>` - Starts all configured bots and handles shutdown

**Constructor**:
```typescript
constructor(app: TokenRingApp, options: ParsedDiscordServiceConfig)
```

**Internal Implementation**:
- Uses `KeyedRegistry` to manage multiple `DiscordBot` instances
- Starts all configured bots on initialization
- Handles graceful shutdown by stopping all bots and cleaning up resources

### DiscordBot

Handles individual bot operations including message processing, agent management, and communication.

**Class**: `DiscordBot`

**Methods**:
- `start(): Promise<void>` - Initializes and starts the Discord bot
- `stop(): Promise<void>` - Stops the bot and cleans up resources
- `getBotUserId(): string | undefined` - Returns the Discord user ID of the bot
- `createCommunicationChannelWithChannel(channelName: string): CommunicationChannel` - Creates a communication channel for escalation
- `createCommunicationChannelWithUser(userId: string): CommunicationChannel` - Creates a DM communication channel

**Internal Methods**:
- `handleMessage(message: Message): Promise<void>` - Processes incoming Discord messages
- `handleDirectMessage(message: Message, userId: string, channelId: string, text: string): Promise<void>` - Handles DM messages
- `extractAllAttachments(message: Message): Promise<InputAttachment[]>` - Downloads and processes file attachments
- `ensureAgentForChannel(channelId: string, agentType: string): Promise<Agent>` - Ensures an agent exists for a channel
- `flushBuffer(channelId: string): Promise<void>` - Sends buffered messages to Discord
- `sendMessage(channelId: string, text: string): Promise<string>` - Sends a message to a channel
- `updateMessageWithFallback(channelId: string, messageId: string, text: string): Promise<string>` - Updates a message with fallback to new message
- `agentEventLoop(channelId: string, agent: Agent, signal: AbortSignal): Promise<void>` - Processes agent events for a channel

**Key Features**:
- **Message buffering**: Accumulates agent output and sends in chunks
- **Rate limiting**: 250ms delay between messages to respect Discord limits
- **Message editing**: Attempts to update existing messages before creating new ones
- **Reply tracking**: Tracks user replies to enable escalation workflows
- **Attachment processing**: Downloads and converts attachments to base64 for agent processing

### DiscordEscalationProvider

Integration with the escalation system for admin communications via Discord.

**Class**: `DiscordEscalationProvider implements EscalationProvider`

**Constructor**:
```typescript
constructor(config: ParsedDiscordEscalationProviderConfig)
```

**Methods**:
- `createCommunicationChannelWithUser(channelName: string, agent: Agent): Promise<CommunicationChannel>` - Creates a communication channel for escalation

**Implementation**:
- Retrieves the configured bot from `DiscordService`
- Creates a communication channel for the specified channel configuration
- Enables escalation workflows through Discord

### splitIntoChunks

Utility function for splitting long messages into Discord-compatible chunks.

**Function**: `splitIntoChunks(text: string | null): string[]`

**Parameters**:
- `text: string | null` - The text to split

**Returns**: Array of message chunks (max 1990 characters each)

**Behavior**:
- Splits text at markdown headers (`#`) when possible for better formatting
- Falls back to character-based splitting at 1990 character limit
- Returns working messages for null input (e.g., "Working...", "Processing...")

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

#### ChatResponse

Type for tracking chat response state per channel.

```typescript
type ChatResponse = {
  text: string | null;
  messageIds: (string | undefined)[];
  sentTexts: string[];
  isComplete?: boolean;
};
```

#### UserChannel

Type for tracking user communication channels for escalation.

```typescript
type UserChannel = {
  destinationId: string;
  trackedMessageIds: Set<string>;
  queue: string[];
  resolve?: (value: IteratorResult<string>) => void;
  closed: boolean;
};
```

## Usage Examples

### Basic Configuration

```typescript
import { z } from "zod";
import TokenRingApp from "@tokenring-ai/app";
import discordPlugin from "@tokenring-ai/discord/plugin";

// Configure the plugin
const config = {
  discord: {
    bots: {
      primary: {
        name: "Primary Bot",
        botToken: process.env.DISCORD_BOT_TOKEN!,
        joinMessage: "Discord bot is online and ready!",
        maxFileSize: 20_971_520, // 20MB
        channels: {
          engineering: {
            channelId: "123456789012345678",
            allowedUsers: [], // Empty = all users
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
  },
  escalation: {
    providers: {
      discordAdmins: {
        type: "discord",
        bot: "primary",
        channel: "engineering"
      }
    }
  }
};

// Install the plugin
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
        }
      }
    }
  },
  escalation: {
    providers: {
      discordAdmins: {
        type: "discord",
        bot: "adminBot",
        channel: "adminChannel"
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

## Configuration

### Configuration Schemas

#### DiscordBotConfigSchema

Configuration for a single Discord bot instance.

```typescript
export const DiscordBotConfigSchema = z.object({
  name: z.string(),
  botToken: z.string().min(1, "Bot token is required"),
  joinMessage: z.string().optional(),
  maxFileSize: z.number().default(20_971_520),
  channels: z.record(z.string(), z.object({
    channelId: z.string(),
    allowedUsers: z.array(z.string()).default([]),
    agentType: z.string(),
  })),
  dmAgentType: z.string().optional(),
  dmAllowedUsers: z.array(z.string()).default([]),
});
```

**Properties**:

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `name` | string | Yes | - | Display name for the bot |
| `botToken` | string | Yes | - | Discord bot token |
| `joinMessage` | string | No | - | Message sent when bot joins a channel |
| `maxFileSize` | number | No | 20971520 (20MB) | Maximum attachment size in bytes |
| `channels` | Record | Yes | - | Channel configurations |
| `dmAgentType` | string | No | - | Agent type for DM interactions |
| `dmAllowedUsers` | string[] | No | [] | Authorized user IDs for DMs |

#### Channel Configuration

```typescript
{
  channelId: string,
  allowedUsers: string[],
  agentType: string
}
```

**Properties**:

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `channelId` | string | Yes | - | Discord channel ID |
| `allowedUsers` | string[] | No | [] | Authorized user IDs (empty = all users) |
| `agentType` | string | Yes | - | Type of agent to use for this channel |

#### DiscordServiceConfigSchema

Configuration for the Discord service.

```typescript
export const DiscordServiceConfigSchema = z.object({
  bots: z.record(z.string(), DiscordBotConfigSchema)
});
```

**Properties**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `bots` | Record<string, DiscordBotConfig> | Yes | Map of bot names to configurations |

#### DiscordEscalationProviderConfigSchema

Configuration for the Discord escalation provider.

```typescript
export const DiscordEscalationProviderConfigSchema = z.object({
  type: z.literal('discord'),
  bot: z.string(),
  channel: z.string(),
});
```

**Properties**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | "discord" | Yes | Provider type identifier |
| `bot` | string | Yes | Name of the bot to use |
| `channel` | string | Yes | Name of the channel configuration |

### Full Configuration Example

```typescript
import { z } from "zod";

const fullConfig = {
  discord: {
    bots: {
      primary: {
        name: "Primary Bot",
        botToken: process.env.DISCORD_BOT_TOKEN!,
        joinMessage: "🤖 TokenRing bot is online!",
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
  },
  escalation: {
    providers: {
      discordAdmins: {
        type: "discord",
        bot: "primary",
        channel: "engineering"
      }
    }
  }
};
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
- **DiscordService**: Manages bot instances
- **DiscordEscalationProvider**: Registered with EscalationService for providers with `type: "discord"`

### Agent Integration

Each Discord channel maintains its own agent instance:
- Agents are spawned on first message to a channel
- Agent context persists for the channel's lifetime
- Background event loops process agent outputs
- Agents are cleaned up on bot shutdown

### Event Handling

The package handles Discord events:
- `messageCreate`: Processes incoming messages
- Bot mentions trigger agent interactions in guild channels
- Direct messages are handled separately
- Reply tracking enables escalation workflows

### Gateway Intents

The Discord client uses the following Gateway Intents:
- `GatewayIntentBits.Guilds`: Server/guild operations
- `GatewayIntentBits.GuildMessages`: Guild message events
- `GatewayIntentBits.MessageContent`: Message content access
- `GatewayIntentBits.DirectMessages`: Direct message events

### State Management

- Each channel maintains a `ChatResponse` buffer
- Messages are tracked by Discord message ID
- User channels track reply messages for escalation
- State is cleaned up on bot shutdown

## RPC Endpoints

This package does not expose RPC endpoints. Communication is handled through Discord's native messaging system.

## State Management

### ChatResponse State

Each active channel maintains a `ChatResponse` object:

```typescript
type ChatResponse = {
  text: string | null;
  messageIds: (string | undefined)[];
  sentTexts: string[];
  isComplete?: boolean;
};
```

**Properties**:
- `text`: Accumulated response text
- `messageIds`: Discord message IDs for each chunk
- `sentTexts`: Previously sent text chunks
- `isComplete`: Whether the response is finished

### UserChannel State

Communication channels track state for escalation:

```typescript
type UserChannel = {
  destinationId: string;
  trackedMessageIds: Set<string>;
  queue: string[];
  resolve?: (value: IteratorResult<string>) => void;
  closed: boolean;
};
```

### Persistence Patterns

- Agent instances persist per channel
- Message IDs are tracked for updates
- Reply messages are associated with channels
- State is restored between agent event processing

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
    environment: 'node',
    globals: true
  }
});
```

### Example Test

```typescript
import { describe, it, expect } from 'vitest';

describe('Discord Package', () => {
  it('should export required components', () => {
    expect(DiscordService).toBeDefined();
    expect(DiscordEscalationProvider).toBeDefined();
    expect(DiscordBotConfigSchema).toBeDefined();
  });
});
```

### Test File

The package includes a test file at `test/configuration.test.ts` for testing configuration validation and schema parsing.

## Best Practices

### Bot Token Security

- Store tokens in environment variables
- Never commit tokens to version control
- Use different tokens for development and production

### Channel Authorization

- Use `allowedUsers` to restrict channel access
- Empty `allowedUsers` array allows all users
- Combine with Discord role-based permissions

### Message Rate Limiting

- The package implements 250ms rate limiting automatically
- Large responses are automatically chunked
- Message edits are preferred over new messages

### Attachment Handling

- Set appropriate `maxFileSize` limits
- Monitor attachment processing errors
- Consider bandwidth implications for large files

### Agent Configuration

- Use distinct `agentType` values per channel
- Configure appropriate agent capabilities per use case
- Monitor agent resource usage for high-traffic channels

### Escalation Setup

- Configure dedicated channels for escalation
- Use specific bot instances for admin communications
- Test escalation workflows before production use

## Development

### Build

```bash
bun run build
```

### Test

```bash
bun run test
```

### Test Watch Mode

```bash
bun run test:watch
```

### Test Coverage

```bash
bun run test:coverage
```

## License

MIT License - see LICENSE file for details.

---

## Related Components

- `@tokenring-ai/escalation`: Escalation service and provider interface
- `@tokenring-ai/agent`: Agent management and event handling
- `@tokenring-ai/app`: Base application framework
- `@tokenring-ai/chat`: Chat service for agent interactions
- `@tokenring-ai/utility`: Shared utilities and helpers
- `discord.js`: Discord API client library

# @tokenring-ai/discord

A Token Ring plugin providing Discord integration for AI-powered bot interactions.

## Overview

This package integrates Discord with TokenRing agents, enabling natural conversations through Discord's messaging system. Each Discord user gets their own persistent agent instance that maintains conversation context. The service uses discord.js to connect to the Discord API and manages agent lifecycles for each user.

## Installation

```bash
bun add @tokenring-ai/discord
```

## Prerequisites

- Discord bot token from [Discord Developer Portal](https://discord.com/developers/applications)
- Bot must have the following permissions:
  - Read Messages/View Channels
  - Send Messages
  - Read Message History
  - Message Content Intent (required for reading message content)
- Bot must have Message Content Intent enabled in Discord Developer Portal

## Setup

1. **Create Discord Application** at [https://discord.com/developers/applications](https://discord.com/developers/applications)

2. **Create Bot**:
   - Go to "Bot" section
   - Click "Add Bot"
   - Enable "Message Content Intent" under Privileged Gateway Intents
   - Copy the bot token

3. **Set Bot Permissions**:
   - Go to "OAuth2" > "URL Generator"
   - Select scopes: `bot`
   - Select permissions: `Send Messages`, `Read Messages/View Channels`, `Read Message History`
   - Use generated URL to invite bot to your server

4. **Get Channel ID** (Optional):
   - Enable Developer Mode in Discord (User Settings > Advanced)
   - Right-click channel and select "Copy ID"
   - This channel will receive the startup announcement message

5. **Get User IDs** (Optional):
   - Right-click user and select "Copy ID"

## Configuration

### Plugin Usage (Recommended)

When using as a TokenRing plugin, the service is automatically installed if Discord configuration is provided:

```typescript
import TokenRingApp from "@tokenring-ai/app";

const app = new TokenRingApp({
  // ... other config
  plugins: [
    // ... other plugins
    "@tokenring-ai/discord" // Plugin will auto-install if discord config exists
  ]
});

// Configure in your app config
app.config({
  discord: {
    botToken: process.env.DISCORD_BOT_TOKEN!,
    channelId: process.env.DISCORD_CHANNEL_ID!, // Optional - for startup announcement
    authorizedUserIds: ['123456789012345678', '987654321098765432'], // Optional - empty array for no restrictions
    defaultAgentType: 'teamLeader'
  }
});
```

### Manual Usage

```typescript
import TokenRingApp from "@tokenring-ai/app";
import { DiscordService } from "@tokenring-ai/discord";

const app = new TokenRingApp({
  // ... app configuration
});

const discordService = new DiscordService(app, {
  botToken: process.env.DISCORD_BOT_TOKEN!,
  channelId: process.env.DISCORD_CHANNEL_ID!, // Optional
  authorizedUserIds: ['123456789012345678'], // Optional
  defaultAgentType: 'teamLeader'
});

// Add service to the app
app.addServices(discordService);

// Start the TokenRing app to begin the Discord service
await app.start();
```

## Chat Commands

The Discord service supports interacting with agents via mentions and direct messages:

- **Mention in channel**: `@BotName your message here`
- **Direct message**: Send a message directly to the bot

## Plugin Configuration

### Configuration Schema

```typescript
import { z } from "zod";

export const DiscordServiceConfigSchema = z.object({
  botToken: z.string().min(1, "Bot token is required"),
  channelId: z.string(),
  authorizedUserIds: z.array(z.string()),
  defaultAgentType: z.string()
});
```

**Note:** The schema requires all fields, but the service treats `channelId` and `authorizedUserIds` as optional in practice:
- `channelId`: If not provided, no startup announcement will be sent
- `authorizedUserIds`: If empty array (`[]`), all users are authorized

### Configuration Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `botToken` | `string` | Yes | - | Discord bot token from Discord Developer Portal |
| `channelId` | `string` | No | - | Channel ID for startup announcement message |
| `authorizedUserIds` | `string[]` | No | `[]` | List of user IDs authorized to interact with the bot (empty array allows all users) |
| `defaultAgentType` | `string` | Yes | - | Default agent type to spawn for users |

### Environment Variables

```bash
# Required
DISCORD_BOT_TOKEN=your-bot-token-here

# Optional
DISCORD_CHANNEL_ID=123456789012345678        # Channel ID for startup announcement
DISCORD_AUTHORIZED_USERS=123456789012345678,987654321098765432  # Comma-separated list (empty allows all)
DISCORD_DEFAULT_AGENT_TYPE=teamLeader        # Default agent type
```

## API Reference

### DiscordService

Main service class that handles Discord integration. Implements the `TokenRingService` interface.

#### Constructor

```typescript
constructor(app: TokenRingApp, options: DiscordServiceConfig)
```

**Parameters:**
- `app`: TokenRingApp instance
- `options`: DiscordServiceConfig object

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Service name, always `"DiscordService"` |
| `description` | `string` | Service description: `"Provides a Discord bot for interacting with TokenRing agents."` |
| `running` | `boolean` | Indicates if the service is currently running |
| `client` | `Client \| null` | Discord.js client instance (private) |
| `userAgents` | `Map<string, Agent>` | Map of user IDs to their associated agents (private) |
| `lastResponseSent` | `boolean` | Tracks whether a response was sent for the current request (private) |

#### Methods

##### `run(signal: AbortSignal): Promise<void>`

Starts the Discord bot and begins listening for messages. The service will automatically handle cleanup when the signal is aborted.

**Parameters:**
- `signal`: AbortSignal that triggers service shutdown

**Behavior:**
- Creates a Discord.js client with the following intents:
  - `GatewayIntentBits.Guilds`
  - `GatewayIntentBits.GuildMessages`
  - `GatewayIntentBits.MessageContent`
  - `GatewayIntentBits.DirectMessages`
- Registers message handler for `messageCreate` events
- Sends startup announcement to configured channel (if `channelId` is provided)
- Returns a promise that resolves when the abort signal is triggered

**Cleanup on shutdown:**
- Deletes all user agents via `AgentManager`
- Clears the user agents map
- Destroys the Discord client

##### `getOrCreateAgentForUser(userId: string): Promise<Agent>`

Gets or creates an agent for the specified user. Creates a new agent if one doesn't exist for the user.

**Parameters:**
- `userId`: Discord user ID

**Returns:**
- `Promise<Agent>`: The user's agent instance

**Behavior:**
- Retrieves `AgentManager` service from the app
- Spawns a new agent with `defaultAgentType` if user doesn't have one
- Stores the agent in the user agents map

##### `handleChatOutput(message: Message, content: string): Promise<void>`

Formats and sends chat messages to Discord, splitting long messages into chunks to respect Discord's character limits.

**Parameters:**
- `message`: Original Discord message
- `content`: Chat content to send

**Behavior:**
- Sets `lastResponseSent` to `true`
- Splits content into chunks of 2000 characters maximum
- Sends each chunk as a separate reply

##### `handleSystemOutput(message: Message, messageText: string, level: string): Promise<void>`

Formats and sends system messages (info, warning, error) to Discord.

**Parameters:**
- `message`: Original Discord message
- `messageText`: Message content
- `level`: Message level (`"info"`, `"warning"`, or `"error"`)

**Behavior:**
- Formats message as `[LEVEL]: message`
- Sends formatted message as a reply

##### `chunkText(text: string, maxLength: number): string[]`

Splits text into chunks of specified maximum length, preserving line breaks.

**Parameters:**
- `text`: Text to split
- `maxLength`: Maximum length of each chunk

**Returns:**
- `string[]`: Array of text chunks

**Behavior:**
- Splits text by lines
- Accumulates lines into chunks without exceeding maxLength
- Preserves line breaks within chunks

## Event System Integration

The Discord service handles multiple event types from the agent system:

### Event Types

| Event Type | Description |
|------------|-------------|
| `output.chat` | Regular chat messages from the agent |
| `output.info` | Informational messages |
| `output.warning` | Warning messages |
| `output.error` | Error messages |
| `input.handled` | Indicates that the agent has finished processing the input |

### Message Handling Flow

1. User sends a message (mention or DM)
2. Service validates authorization
3. Service gets or creates agent for user
4. Service waits for agent to be idle
5. Service sends message to agent via `handleInput`
6. Service subscribes to agent state events
7. Service processes events as they occur:
   - `output.chat` → Sends chat message to Discord
   - `output.info/warning/error` → Sends formatted system message
   - `input.handled` → Unsubscribes and sends default message if no response
8. Service handles timeout if `maxRunTime` is configured

### Message Formatting

The service formats messages differently based on type:

- **Chat messages**: Sent as normal Discord replies
- **System messages**: Formatted as `[LEVEL]: message` where LEVEL is INFO, WARNING, or ERROR

## Features

- **Per-User Agents**: Each Discord user gets a dedicated agent with persistent chat context
- **@Mentions**: Respond to mentions in channels with intelligent AI responses
- **Direct Messages**: Private conversations with the bot in your DMs
- **Authorization**: Restricts access to a list of authorized user IDs (empty array allows all users)
- **Event-Driven Communication**: Handles agent events and sends responses back to Discord
- **Automatic Agent Management**: Creates and manages agents for each user automatically
- **Timeout Handling**: Configurable response timeouts with automatic cleanup
- **Message Formatting**: System messages with proper formatting (info, warning, error levels)
- **Multiple Output Types**: Supports chat messages, info messages, warnings, and error messages
- **Message Chunking**: Automatically splits long messages to respect Discord's 2000 character limit
- **Idle Waiting**: Waits for agent to be idle before sending new messages
- **Startup Announcement**: Sends "Discord bot is online!" to configured channel on startup

## Plugin Architecture

The package exports a TokenRing plugin that automatically installs the DiscordService when configuration is provided:

```typescript
import plugin from "@tokenring-ai/discord/plugin";

// Plugin configuration schema
const config = {
  discord: {
    botToken: "your-bot-token",
    channelId: "123456789",
    authorizedUserIds: ["user-id-1"],
    defaultAgentType: "teamLeader"
  }
};

// Install plugin
app.install(plugin, config);
```

## Notes

- **Message Content Intent**: Must be enabled in Discord Developer Portal for the bot to read message content
- **User Agents**: Each user's agent maintains independent conversation state
- **Cleanup**: Agents are automatically cleaned up when the service stops
- **Authorization**: Empty `authorizedUserIds` array allows all users to interact with the bot
- **Message Length**: Responses are automatically chunked to respect Discord's 2000 character limit
- **Timeout Handling**: Agents have configurable timeouts via `agent.config.maxRunTime`
- **Startup Announcement**: Bot sends "Discord bot is online!" message to the configured channel on startup (if `channelId` is provided)
- **Plugin System**: Designed to work seamlessly with TokenRing's plugin architecture
- **Idle State**: Bot waits for agent to reach idle state before processing new messages

## Troubleshooting

### Common Issues

1. **Bot not responding**: Ensure Message Content Intent is enabled in Discord Developer Portal
2. **"Not authorized" message**: Check that your user ID is in the `authorizedUserIds` list (or leave empty for all users)
3. **Bot offline**: Check that the bot token is valid and the bot is invited to your server
4. **Agent timeouts**: Verify the `maxRunTime` setting in your agent configuration if using custom agent types
5. **Long messages not sent**: The service automatically chunks messages to respect Discord's character limit
6. **Startup message not received**: Ensure the `channelId` is correct and the bot has permission to send messages in that channel
7. **No response received**: If the agent doesn't produce any output, a default "No response received from agent." message will be sent

## Testing

The package includes comprehensive unit tests:

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run tests with coverage
bun test --coverage
```

### Test Coverage

- Configuration validation with Zod schema
- Type inference for configuration
- Schema parsing and validation

### Test Files

- `test/configuration.test.ts` - Configuration schema tests

## Dependencies

### Production Dependencies

- `@tokenring-ai/app` (0.2.0) - Application framework
- `@tokenring-ai/chat` (0.2.0) - Chat service integration
- `@tokenring-ai/agent` (0.2.0) - Agent management
- `@tokenring-ai/utility` (0.2.0) - Utility functions
- `discord.js` (^14.25.1) - Discord API client
- `zod` (^4.3.6) - Schema validation

### Development Dependencies

- `vitest` (^4.0.18) - Testing framework
- `typescript` (^5.9.3) - TypeScript compiler

## Exports

```typescript
// Main service
export {default as DiscordService} from "./DiscordService.ts";

// Types
export type {DiscordServiceConfig} from "./DiscordService.ts";

// Schema
export {DiscordServiceConfigSchema} from "./DiscordService.ts";

// Plugin
export {default as plugin} from "./plugin.ts";
```

## License

MIT License - see [LICENSE](./LICENSE) file for details.

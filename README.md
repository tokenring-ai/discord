# @tokenring-ai/discord

A Token Ring plugin providing Discord integration for AI-powered bot interactions.

## Overview

This package integrates Discord with TokenRing agents, enabling natural conversations through Discord's messaging system. Each Discord user gets their own persistent agent instance that maintains conversation context.

## Installation

```bash
bun install @tokenring-ai/discord
# or
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

4. **Get Channel ID** (Required):
   - Enable Developer Mode in Discord (User Settings > Advanced)
   - Right-click channel and select "Copy ID"
   - This channel will receive the startup announcement message

5. **Get User IDs** (Required):
   - Right-click user and select "Copy ID"

## Configuration

### Plugin Usage (Recommended)

When using as a TokenRing plugin, the service is automatically installed:

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
    channelId: process.env.DISCORD_CHANNEL_ID!,
    authorizedUserIds: ['123456789012345678', '987654321098765432'],
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
  channelId: process.env.DISCORD_CHANNEL_ID!,
  authorizedUserIds: ['123456789012345678'],
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

const DiscordServiceConfigSchema = z.object({
  botToken: z.string().min(1, "Bot token is required"),
  channelId: z.string().min(1, "Channel ID is required"),
  authorizedUserIds: z.array(z.string().min(1), "Authorized user IDs are required"),
  defaultAgentType: z.string().min(1, "Default agent type is required")
});
```

### Configuration Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `botToken` | `string` | Yes | - | Discord bot token from Discord Developer Portal |
| `channelId` | `string` | Yes | - | Channel ID for startup announcement message |
| `authorizedUserIds` | `string[]` | Yes | - | List of user IDs authorized to interact with the bot |
| `defaultAgentType` | `string` | Yes | - | Default agent type to spawn for users |

### Environment Variables

```bash
# Required
DISCORD_BOT_TOKEN=your-bot-token-here
DISCORD_CHANNEL_ID=123456789012345678        # Channel ID for startup announcement
DISCORD_AUTHORIZED_USERS=123456789012345678,987654321098765432  # Comma-separated list
DISCORD_DEFAULT_AGENT_TYPE=teamLeader        # Default agent type
```

## API Reference

### DiscordService

Main service class that handles Discord integration.

#### Constructor

```typescript
constructor(app: TokenRingApp, config: DiscordServiceConfig)
```

**Parameters:**
- `app`: TokenRingApp instance
- `config`: DiscordServiceConfig object (all fields required)

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Service name, always "DiscordService" |
| `description` | `string` | Service description |
| `running` | `boolean` | Indicates if the service is currently running |
| `client` | `Client \| null` | Discord.js client instance |
| `userAgents` | `Map<string, Agent>` | Map of user IDs to their associated agents |

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `run` | `run(signal: AbortSignal): Promise<void>` | Start the Discord bot and begin listening for messages. The service will automatically handle cleanup when the signal is aborted. |
| `handleChatOutput` | `handleChatOutput(message: Message, content: string): Promise<void>` | Formats and sends chat messages to Discord, splitting long messages into chunks to respect Discord's character limits. |
| `handleSystemOutput` | `handleSystemOutput(message: Message, messageText: string, level: string): Promise<void>` | Formats system messages (info, warning, error) with appropriate labels. |
| `chunkText` | `chunkText(text: string, maxLength: number): string[]` | Splits text into chunks of specified maximum length. |
| `getOrCreateAgentForUser` | `getOrCreateAgentForUser(userId: string): Promise<Agent>` | Gets or creates an agent for the specified user. |

### DiscordServiceConfig

```typescript
type DiscordServiceConfig = {
  botToken: string;
  channelId: string;
  authorizedUserIds: string[];
  defaultAgentType: string;
};
```

### DiscordServiceConfigSchema

```typescript
export const DiscordServiceConfigSchema = z.object({
  botToken: z.string().min(1, "Bot token is required"),
  channelId: z.string().min(1, "Channel ID is required"),
  authorizedUserIds: z.array(z.string().min(1), "Authorized user IDs are required"),
  defaultAgentType: z.string().min(1, "Default agent type is required")
});
```

### Exports

```typescript
export { default as DiscordService } from "./DiscordService.ts";
export type { DiscordServiceConfig } from "./DiscordService.ts";
export { DiscordServiceConfigSchema } from "./DiscordService.ts";
```

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

### Message Formatting

The service formats messages differently based on type:

- **Chat messages**: Sent as normal Discord messages
- **System messages**: Formatted as `[LEVEL]: message` where LEVEL is INFO, WARNING, or ERROR

## Features

- **Per-User Agents**: Each Discord user gets a dedicated agent with persistent chat context
- **@Mentions**: Respond to mentions in channels with intelligent AI responses
- **Direct Messages**: Private conversations with the bot in your DMs
- **Authorization**: Restricts access to a list of authorized user IDs
- **Event-Driven Communication**: Handles agent events and sends responses back to Discord
- **Automatic Agent Management**: Creates and manages agents for each user automatically
- **Timeout Handling**: Configurable response timeouts with automatic cleanup
- **Message Formatting**: System messages with proper formatting (info, warning, error levels)
- **Multiple Output Types**: Supports chat messages, info messages, warnings, and error messages
- **Message Chunking**: Automatically splits long messages to respect Discord's 2000 character limit

## Notes

- **Message Content Intent**: Must be enabled in Discord Developer Portal for the bot to read message content
- **User Agents**: Each user's agent maintains independent conversation state
- **Cleanup**: Agents are automatically cleaned up when the service stops
- **Authorization**: Only users in the `authorizedUserIds` list can interact with the bot
- **Message Length**: Responses are truncated to 2000 characters (Discord limit) with automatic chunking
- **Timeout Handling**: Agents have configurable timeouts via `agent.config.maxRunTime`
- **Startup Announcement**: Bot sends "Discord bot is online!" message to the configured channel on startup
- **Plugin System**: Designed to work seamlessly with TokenRing's plugin architecture

## Troubleshooting

### Common Issues

1. **Bot not responding**: Ensure Message Content Intent is enabled in Discord Developer Portal
2. **"Not authorized" message**: Check that your user ID is in the `authorizedUserIds` list
3. **Bot offline**: Check that the bot token is valid and the bot is invited to your server
4. **Agent timeouts**: Verify the `maxRunTime` setting in your agent configuration if using custom agent types
5. **Long messages not sent**: The service automatically chunks messages to respect Discord's character limit
6. **Startup message not received**: Ensure the `channelId` is correct and the bot has permission to send messages in that channel

## License

MIT License - see [LICENSE](./LICENSE) file for details.

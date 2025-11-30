# @tokenring-ai/discord

A Token Ring plugin providing Discord integration for AI-powered bot interactions.

## Overview

This package integrates Discord with TokenRing agents, enabling natural conversations through Discord's messaging system. Each Discord user gets their own persistent agent instance that maintains conversation history and context.

## Features

- **Per-User Agents**: Each Discord user gets a dedicated agent with persistent chat history
- **@Mentions**: Respond to mentions in channels with intelligent AI responses
- **Direct Messages**: Private conversations with the bot in your DMs
- **Authorization**: Optional user whitelist for restricted access
- **Event-Driven Communication**: Handles agent events and sends responses back to Discord
- **Automatic Agent Management**: Creates and manages agents for each user automatically
- **Plugin Architecture**: Automatically integrates with TokenRing applications

## Installation

```bash
npm install @tokenring-ai/discord
# or
bun add @tokenring-ai/discord
```

## Prerequisites

- Discord bot token from [Discord Developer Portal](https://discord.com/developers/applications)
- Bot must have the following permissions:
  - Read Messages/View Channels
  - Send Messages
  - Read Message History
- Bot must have Message Content Intent enabled

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

4. **Get Channel ID** (optional):
   - Enable Developer Mode in Discord (User Settings > Advanced)
   - Right-click channel and select "Copy ID"

5. **Get User IDs** (optional):
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
    channelId: process.env.DISCORD_CHANNEL_ID, // Optional
    authorizedUserIds: ['123456789012345678', '987654321098765432'], // Optional
    defaultAgentType: 'teamLeader' // Optional
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
  channelId: process.env.DISCORD_CHANNEL_ID, // Optional
  authorizedUserIds: ['123456789012345678'], // Optional
  defaultAgentType: 'teamLeader' // Optional
});

// Add service to the app
app.addServices(discordService);

// Start the service
await discordService.start();
```

## API Reference

### DiscordService

Main service class that handles Discord integration.

#### Constructor

```typescript
new DiscordService(
  app: TokenRingApp,
  config: DiscordServiceConfig
)
```

#### Methods

- `start(): Promise<void>` - Start the Discord bot and begin listening for messages
- `stop(): Promise<void>` - Stop the bot and clean up user agents

### DiscordServiceConfig

Configuration interface for the Discord service.

```typescript
interface DiscordServiceConfig {
  botToken: string;           // Required: Discord bot token
  channelId?: string;         // Optional: Channel for startup announcements
  authorizedUserIds?: string[]; // Optional: List of authorized user IDs
  defaultAgentType?: string;  // Optional: Default agent type (defaults to "teamLeader")
}
```

### Exports

```typescript
export { default as DiscordService } from "./DiscordService.ts";
export type { DiscordServiceConfig } from "./DiscordService.ts";
export { DiscordServiceConfigSchema } from "./DiscordService.ts";
```

## Usage Examples

### Basic Interaction

- **Mention in channel**: `@BotName what is the weather today?`
- **Direct message**: Send a message directly to the bot

### Advanced Configuration

```typescript
// Environment variables
DISCORD_BOT_TOKEN=your-bot-token-here
DISCORD_CHANNEL_ID=123456789012345678        # Optional for startup announcements
DISCORD_AUTHORIZED_USERS=123456789012345678,987654321098765432  # Optional comma-separated list
```

## Dependencies

- `discord.js` ^14.17.3 - Discord API library
- `@tokenring-ai/chat` ^0.2.0 - TokenRing chat functionality
- `@tokenring-ai/agent` ^0.2.0 - TokenRing agent system
- `@tokenring-ai/app` ^0.2.0 - TokenRing application framework
- `zod` ^4.1.13 - Schema validation

## Notes

- **Message Content Intent**: Must be enabled in Discord Developer Portal for the bot to read message content
- **User Agents**: Each user's agent maintains independent conversation state
- **Cleanup**: Agents are automatically cleaned up when the service stops
- **Authorization**: If `authorizedUserIds` is empty, all users can interact. Set a list to restrict access
- **Message Length**: Responses are truncated to 2000 characters (Discord limit)
- **Plugin System**: Designed to work seamlessly with TokenRing's plugin architecture

## Troubleshooting

### Common Issues

1. **Bot not responding**: Ensure Message Content Intent is enabled in Discord Developer Portal
2. **"Not authorized" message**: Add your user ID to `authorizedUserIds` or remove the restriction
3. **Bot offline**: Check that the bot token is valid and the bot is invited to your server

## License

MIT License - see [LICENSE](./LICENSE) file for details.

# @tokenring-ai/discord

Discord transport for TokenRing bots.

This plugin connects Discord application accounts and exposes each account as a
`MessagingProvider` to `@tokenring-ai/bot`. Bot personalities, agents,
authorization, channel routing, direct-message policy, join messages, and
outreach are configured in the bot plugin.

## Configuration

```yaml
discord:
  accounts:
    discord:
      botToken: ${secret:DISCORD_BOT_TOKEN}
      maxFileSize: 20971520

bot:
  bots:
    assistant:
      agentType: leader
      displayName: Assistant
      directMessages: configuredUsers
      users:
        discord:123456789012345678: admin
      channels:
        engineering:
          target: discord:987654321098765432
          allowedUsers: []
```

Account names are service names. A Discord account named `discord` therefore
addresses users and channels as `discord:<snowflake>`.

| Account field | Required | Default | Description |
|---|---:|---:|---|
| `botToken` | yes | — | Discord application bot token |
| `maxFileSize` | no | 20 MiB | Largest attachment downloaded from Discord |

Tokens use the standard `@tokenring-ai/secrets` secret-reference format and are
resolved before an account connects.

## Connect command

```text
/connect discord --name=discord
```

The interactive command asks for the token using a masked prompt and saves the
account to user configuration by default. Pass `--save=project` to save it in
the project layer.

## Discord application setup

Enable the following gateway intents for the application:

- Guilds
- Guild Messages
- Message Content
- Direct Messages

The bot needs permission to view and send messages in configured channels. File
attachments are downloaded only after `BotService` has claimed the message.

## Transport behavior

- DMs are always marked addressed; `BotService` applies the configured DM policy.
- Guild messages are marked addressed when they mention the application or
  reply to one of its messages.
- Discord thread ids become conversation ids, while their parent channel is
  reported as the room id. Threads therefore get separate agent histories while
  inheriting parent-channel configuration.
- First traffic from a guild channel reports it as an observed channel. Discord
  does not expose a precise per-channel bot invitation event, so observed
  channels never trigger invitation-based auto-join.
- User targets are resolved to DM channels; channel targets pass through.
- Agent output can be posted and edited in place, and replies stay attached to
  the originating Discord message.

## Migration from the legacy plugin

The old `discord.bots` configuration mixed credentials with agent behavior.
Move credentials to `discord.accounts`, and move the remaining behavior to
`bot.bots`:

- `botToken` and `maxFileSize` → `discord.accounts.<service>`
- `name`, `joinMessage`, agent types, users, channels, and DM policy →
  `bot.bots.<bot>`
- channel ids → bot channel targets such as `discord:<channelId>`
- Discord user ids → bot users such as `discord:<userId>`
- escalation providers → the bot's normal `contact`/messaging channel support

Environment-variable import and the legacy escalation provider are no longer
part of this transport. Store the token through configuration or
`/connect discord`.

## Development

```bash
bun test
bun run build
```

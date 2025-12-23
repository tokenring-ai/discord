import { describe, it, expect } from 'vitest';

import { DiscordServiceConfigSchema, DiscordServiceConfig } from '../DiscordService';

describe('Discord Service Configuration', () => {
  describe('DiscordServiceConfigSchema', () => {
    it('should validate complete valid config', () => {
      const validConfig = {
        botToken: 'valid-bot-token',
        channelId: '123456789',
        authorizedUserIds: ['111111111', '222222222'],
        defaultAgentType: 'teamLeader'
      };

      const result = DiscordServiceConfigSchema.safeParse(validConfig);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validConfig);
      }
    });

    it('should validate minimal config with only botToken', () => {
      const minimalConfig = {
        botToken: 'valid-bot-token'
      };

      const result = DiscordServiceConfigSchema.safeParse(minimalConfig);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(minimalConfig);
      }
    });

    it('should handle configuration examples correctly', () => {
      // Test various configuration scenarios
      const configs = [
        {
          name: 'development config',
          config: {
            botToken: 'DEV_BOT_TOKEN_123456789',
            channelId: '123456789012345678',
            defaultAgentType: 'devAgent'
          }
        },
        {
          name: 'production config with restrictions',
          config: {
            botToken: 'PROD_BOT_TOKEN_987654321',
            channelId: '987654321098765432',
            authorizedUserIds: ['ADMIN_USER_ID_1', 'ADMIN_USER_ID_2'],
            defaultAgentType: 'teamLeader'
          }
        },
        {
          name: 'community bot config',
          config: {
            botToken: 'COMMUNITY_BOT_TOKEN_456789123',
            authorizedUserIds: ['USER1', 'USER2', 'USER3'],
            defaultAgentType: 'communityHelper'
          }
        },
        {
          name: 'minimal public bot',
          config: {
            botToken: 'PUBLIC_BOT_TOKEN_789123456'
          }
        }
      ];

      configs.forEach(({ name, config }) => {
        const result = DiscordServiceConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });
    });

    it('should handle edge cases', () => {
      const edgeCases = [
        {
          name: 'very long bot token',
          config: {
            botToken: 'a'.repeat(1000),
            channelId: '123456789'
          }
        },
        {
          name: 'many authorized users',
          config: {
            botToken: 'valid-token',
            authorizedUserIds: Array.from({ length: 100 }, (_, i) => `user${i}`)
          }
        },
        {
          name: 'special characters in agent type',
          config: {
            botToken: 'valid-token',
            defaultAgentType: 'agent_type-with.special@chars'
          }
        }
      ];

      edgeCases.forEach(({ name, config }) => {
        const result = DiscordServiceConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('DiscordServiceConfig type inference', () => {
    it('should properly infer types from schema', () => {
      const config: DiscordServiceConfig = {
        botToken: 'test-token',
        channelId: '123456',
        authorizedUserIds: ['111111', '222222'],
        defaultAgentType: 'teamLeader'
      };

      expect(config.botToken).toBe('test-token');
      expect(config.channelId).toBe('123456');
      expect(config.authorizedUserIds).toEqual(['111111', '222222']);
      expect(config.defaultAgentType).toBe('teamLeader');
    });

    it('should handle partial config', () => {
      const partialConfig: DiscordServiceConfig = {
        botToken: 'test-token'
      };

      expect(partialConfig.botToken).toBe('test-token');
      expect(partialConfig.channelId).toBeUndefined();
      expect(partialConfig.authorizedUserIds).toBeUndefined();
      expect(partialConfig.defaultAgentType).toBeUndefined();
    });
  });
});
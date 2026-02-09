import {describe, expect, it} from 'vitest';

import {DiscordServiceConfig, DiscordServiceConfigSchema} from '../DiscordService';

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
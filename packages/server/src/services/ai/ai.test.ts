import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { ObjectId } from 'mongodb'
import { connectTestDB, closeTestDB, clearTestDB, getTestDB } from '../../test/setup.js'
import { setDB } from '../../db.js'
import * as aiService from './index.js'

describe('AI service', () => {
  let testUserId: ObjectId

  beforeAll(async () => {
    const db = await connectTestDB()
    setDB(db)
  })

  afterAll(async () => {
    await closeTestDB()
  })

  beforeEach(async () => {
    await clearTestDB()
    testUserId = new ObjectId()
  })

  describe('getAIConfig', () => {
    it('should return null when no config exists', async () => {
      const config = await aiService.getAIConfig(testUserId)
      expect(config).toBeNull()
    })

    it('should return config after saving', async () => {
      await aiService.saveAIConfig(testUserId, {
        provider: 'openai',
        model: 'gpt-4',
        apiKey: 'test-api-key',
        params: {
          temperature: 0.7,
          maxTokens: 2000
        }
      })

      const config = await aiService.getAIConfig(testUserId)
      expect(config).not.toBeNull()
      expect(config?.provider).toBe('openai')
      expect(config?.model).toBe('gpt-4')
    })
  })

  describe('saveAIConfig', () => {
    it('should save new config', async () => {
      await aiService.saveAIConfig(testUserId, {
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        apiKey: 'sk-ant-test',
        params: {
          temperature: 0.5,
          maxTokens: 4000
        }
      })

      const db = getTestDB()
      const config = await db.collection('ai_config').findOne({ userId: testUserId })

      expect(config).not.toBeNull()
      expect(config?.provider).toBe('anthropic')
      expect(config?.model).toBe('claude-3-sonnet')
      // API key should be encrypted
      expect(config?.apiKey).not.toBe('sk-ant-test')
      // userId must be stored in the document
      expect(config?.userId.toString()).toBe(testUserId.toString())
    })

    it('should update existing config', async () => {
      // Save initial config
      await aiService.saveAIConfig(testUserId, {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        apiKey: 'initial-key',
        params: { temperature: 0.7, maxTokens: 2000 }
      })

      // Update config
      await aiService.saveAIConfig(testUserId, {
        provider: 'openai',
        model: 'gpt-4',
        params: { temperature: 0.5, maxTokens: 4000 }
      })

      const config = await aiService.getAIConfig(testUserId)
      expect(config?.model).toBe('gpt-4')
      expect(config?.params.temperature).toBe(0.5)
    })

    it('should preserve apiKey when not provided in update', async () => {
      await aiService.saveAIConfig(testUserId, {
        provider: 'openai',
        model: 'gpt-4',
        apiKey: 'original-key',
        params: { temperature: 0.7, maxTokens: 2000 }
      })

      const originalConfig = await aiService.getAIConfig(testUserId)
      const originalEncryptedKey = originalConfig?.apiKey

      // Update without apiKey
      await aiService.saveAIConfig(testUserId, {
        provider: 'openai',
        model: 'gpt-4-turbo',
        params: { temperature: 0.8, maxTokens: 3000 }
      })

      const updatedConfig = await aiService.getAIConfig(testUserId)
      expect(updatedConfig?.apiKey).toBe(originalEncryptedKey)
    })
  })

  describe('getAIConfigMasked', () => {
    it('should return masked apiKey', async () => {
      await aiService.saveAIConfig(testUserId, {
        provider: 'openai',
        model: 'gpt-4',
        apiKey: 'sk-1234567890abcdef',
        params: { temperature: 0.7, maxTokens: 2000 }
      })

      const masked = await aiService.getAIConfigMasked(testUserId)
      expect(masked).not.toBeNull()
      expect(masked?.apiKeyMasked).toContain('***')
      expect(masked?.apiKeyMasked).not.toBe('sk-1234567890abcdef')
    })
  })

  describe('getProviderDefaultModels', () => {
    it('should return models for openai', () => {
      const models = aiService.getProviderDefaultModels('openai')
      expect(models.length).toBeGreaterThan(0)
      expect(models.some(m => m.id.includes('gpt'))).toBe(true)
    })

    it('should return models for anthropic', () => {
      const models = aiService.getProviderDefaultModels('anthropic')
      expect(models.length).toBeGreaterThan(0)
      expect(models.some(m => m.id.includes('claude'))).toBe(true)
    })

    it('should return models for ollama', () => {
      const models = aiService.getProviderDefaultModels('ollama')
      expect(models.length).toBeGreaterThan(0)
    })
  })

  describe('user isolation', () => {
    it('should not return config from another user', async () => {
      const otherUserId = new ObjectId()

      await aiService.saveAIConfig(testUserId, {
        provider: 'openai',
        model: 'gpt-4',
        apiKey: 'user1-key',
        params: { temperature: 0.7, maxTokens: 2000 }
      })

      const otherUserConfig = await aiService.getAIConfig(otherUserId)
      expect(otherUserConfig).toBeNull()
    })
  })
})

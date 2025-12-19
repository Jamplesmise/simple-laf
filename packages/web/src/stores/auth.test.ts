import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuthStore } from './auth'

describe('auth store', () => {
  beforeEach(() => {
    // 重置store状态
    useAuthStore.setState({ token: null, user: null })
    // 清除localStorage mock
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should have null token and user initially', () => {
      const state = useAuthStore.getState()

      expect(state.token).toBeNull()
      expect(state.user).toBeNull()
    })
  })

  describe('setAuth', () => {
    it('should set token and user', () => {
      const { setAuth } = useAuthStore.getState()

      setAuth('test-token', { id: '123', username: 'testuser' })

      const state = useAuthStore.getState()
      expect(state.token).toBe('test-token')
      expect(state.user).toEqual({ id: '123', username: 'testuser' })
    })

    it('should update existing auth', () => {
      const { setAuth } = useAuthStore.getState()

      setAuth('token1', { id: '1', username: 'user1' })
      setAuth('token2', { id: '2', username: 'user2' })

      const state = useAuthStore.getState()
      expect(state.token).toBe('token2')
      expect(state.user?.username).toBe('user2')
    })
  })

  describe('logout', () => {
    it('should clear token and user', () => {
      const { setAuth, logout } = useAuthStore.getState()

      setAuth('test-token', { id: '123', username: 'testuser' })
      logout()

      const state = useAuthStore.getState()
      expect(state.token).toBeNull()
      expect(state.user).toBeNull()
    })
  })

  describe('persistence', () => {
    it('store should have persist middleware configured', () => {
      // 验证store使用了persist中间件
      // persist中间件会在store上添加persist属性
      const store = useAuthStore
      expect(store.persist).toBeDefined()
    })
  })
})

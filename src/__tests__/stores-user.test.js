import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const storage = {}
vi.stubGlobal('localStorage', {
  getItem: (key) => storage[key] ?? null,
  setItem: (key, value) => { storage[key] = value },
  removeItem: (key) => { delete storage[key] },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]) },
})

vi.mock('@/api/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
}))

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), error: vi.fn() },
}))

const { useUserStore } = await import('@/stores/user')
const { login } = await import('@/api/auth')

describe('userStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    storage.token = undefined
    storage.userInfo = undefined
    storage.menus = undefined
  })

  describe('isLoggedIn', () => {
    it('should be false by default', () => {
      const store = useUserStore()
      expect(store.isLoggedIn).toBe(false)
    })

    it('should be true when token is set', () => {
      const store = useUserStore()
      store.token = 'test-token'
      expect(store.isLoggedIn).toBe(true)
    })
  })

  describe('initUser', () => {
    it('should restore user from localStorage', () => {
      localStorage.setItem('token', 'saved-token')
      localStorage.setItem('userInfo', JSON.stringify({ username: 'admin' }))
      localStorage.setItem('menus', JSON.stringify([{ id: 1 }]))

      const store = useUserStore()
      store.initUser()

      expect(store.userInfo).toEqual({ username: 'admin' })
      expect(store.menus).toEqual([{ id: 1 }])
    })
  })

  describe('userLogin', () => {
    it('should store token and userInfo on success', async () => {
      login.mockResolvedValueOnce({
        code: 0,
        data: {
          token: 'new-token',
          userInfo: { username: 'admin' },
          menus: [],
        },
      })

      const store = useUserStore()
      const result = await store.userLogin({ username: 'admin', password: '123456' })

      expect(result).toBe(true)
      expect(store.token).toBe('new-token')
      expect(store.userInfo).toEqual({ username: 'admin' })
      expect(localStorage.getItem('token')).toBe('new-token')
    })

    it('should return false on failure', async () => {
      login.mockResolvedValueOnce({
        code: 1,
        message: '密码错误',
      })

      const store = useUserStore()
      const result = await store.userLogin({ username: 'admin', password: 'wrong' })

      expect(result).toBe(false)
    })
  })

  describe('userLogout', () => {
    it('should clear all state', async () => {
      localStorage.setItem('token', 'old-token')
      localStorage.setItem('userInfo', '{}')
      localStorage.setItem('menus', '[]')

      const store = useUserStore()
      store.token = 'old-token'
      store.userInfo = {}
      store.menus = []

      await store.userLogout()

      expect(store.token).toBe('')
      expect(store.userInfo).toBeNull()
      expect(store.menus).toEqual([])
      expect(localStorage.getItem('token')).toBeNull()
    })
  })
})

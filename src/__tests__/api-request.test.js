import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockAxiosInstance = {
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  },
}

vi.mock('axios', () => ({
  default: { create: vi.fn(() => mockAxiosInstance) },
}))

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), error: vi.fn() },
}))

const mockStore = { token: '', userLogout: vi.fn() }
vi.mock('@/stores/user', () => ({
  useUserStore: () => mockStore,
}))

describe('request interceptors', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockStore.token = ''
    mockAxiosInstance.interceptors.request.use.mockReset()
    mockAxiosInstance.interceptors.response.use.mockReset()
  })

  it('should inject token header when token exists', async () => {
    mockStore.token = 'my-auth-token'
    await import('@/api/request')

    const [onFulfilled] = mockAxiosInstance.interceptors.request.use.mock.calls[0]
    const config = { headers: {} }
    const result = onFulfilled(config)

    expect(result.headers.token).toBe('my-auth-token')
  })

  it('should not inject token when not logged in', async () => {
    mockStore.token = ''
    await import('@/api/request')

    const [onFulfilled] = mockAxiosInstance.interceptors.request.use.mock.calls[0]
    const config = { headers: {} }
    const result = onFulfilled(config)

    expect(result.headers.token).toBeUndefined()
  })

  it('should reject on request error', async () => {
    await import('@/api/request')

    const [, onRejected] = mockAxiosInstance.interceptors.request.use.mock.calls[0]
    const error = new Error('network error')
    await expect(onRejected(error)).rejects.toThrow('network error')
  })

  it('should return data on success response', async () => {
    await import('@/api/request')

    const [onFulfilled] = mockAxiosInstance.interceptors.response.use.mock.calls[0]
    const response = { status: 200, data: { code: 0, message: 'ok', data: [1, 2, 3] } }
    const result = onFulfilled(response)

    expect(result).toEqual({ code: 0, message: 'ok', data: [1, 2, 3] })
  })

  it('should reject on non-200 success response', async () => {
    await import('@/api/request')

    const [onFulfilled] = mockAxiosInstance.interceptors.response.use.mock.calls[0]
    const { ElMessage } = await import('element-plus')
    const response = { status: 400, data: { code: 1, message: '参数错误' } }

    await expect(onFulfilled(response)).rejects.toThrow('参数错误')
    expect(ElMessage.error).toHaveBeenCalledWith('参数错误')
  })

  it('should handle 401 with logout', async () => {
    await import('@/api/request')

    const [, onRejected] = mockAxiosInstance.interceptors.response.use.mock.calls[0]
    const { ElMessage } = await import('element-plus')

    const error = { response: { status: 401 } }
    await expect(onRejected(error)).rejects.toBe(error)
    expect(ElMessage.error).toHaveBeenCalledWith('未授权，请重新登录')
    expect(mockStore.userLogout).toHaveBeenCalled()
  })

  it('should handle 500 error', async () => {
    await import('@/api/request')

    const [, onRejected] = mockAxiosInstance.interceptors.response.use.mock.calls[0]
    const { ElMessage } = await import('element-plus')

    const error = { response: { status: 500 } }
    await expect(onRejected(error)).rejects.toBe(error)
    expect(ElMessage.error).toHaveBeenCalledWith('服务器内部错误')
  })

  it('should handle 404 error', async () => {
    await import('@/api/request')

    const [, onRejected] = mockAxiosInstance.interceptors.response.use.mock.calls[0]
    const { ElMessage } = await import('element-plus')

    const error = { response: { status: 404 } }
    await expect(onRejected(error)).rejects.toBe(error)
    expect(ElMessage.error).toHaveBeenCalledWith('请求地址出错')
  })

  it('should handle network error without response', async () => {
    await import('@/api/request')

    const [, onRejected] = mockAxiosInstance.interceptors.response.use.mock.calls[0]
    const { ElMessage } = await import('element-plus')

    const error = new Error('Network Error')
    await expect(onRejected(error)).rejects.toBe(error)
    expect(ElMessage.error).toHaveBeenCalledWith('网络连接异常')
  })
})

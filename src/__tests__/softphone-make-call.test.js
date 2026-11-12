import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { ElMessage } from 'element-plus'
import SoftPhone from '@/views/SoftPhone.vue'

const sdk = vi.hoisted(() => ({
  makeCall: vi.fn(), init: vi.fn(), addEventListener: vi.fn(), logout: vi.fn()
}))
vi.mock('@/utils/callSdk', () => ({ default: class {
  constructor() { return sdk }
} }))
vi.mock('@/api/softphone', () => ({ agentLogin: vi.fn().mockResolvedValue({ code: 0, data: { token: 'test' } }) }))
vi.mock('@/api/config', () => ({
  getAgentConfigList: vi.fn().mockResolvedValue({ code: 0, data: { list: [] } }),
  getStationList: vi.fn().mockResolvedValue({ code: 0, data: { list: [] } })
}))
vi.mock('jssip', () => ({ UA: vi.fn(), WebSocketInterface: vi.fn() }))

describe('softphone makeCall failures', () => {
  let wrapper
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.spyOn(ElMessage, 'success').mockImplementation(() => {})
    vi.spyOn(ElMessage, 'error').mockImplementation(() => {})
    wrapper = shallowMount(SoftPhone)
    wrapper.vm.loginForm.loginType = 3
    await wrapper.vm.handleConnect()
    await flushPromises()
  })
  afterEach(() => { wrapper.unmount(); vi.restoreAllMocks() })

  it('shows a business error and clears the calling state', async () => {
    sdk.makeCall.mockResolvedValue({ code: 3002, message: '路由错误' })
    await wrapper.vm.handleMakeCall()
    await flushPromises()
    expect(sdk.makeCall).toHaveBeenCalledWith('1005')
    expect(ElMessage.error).toHaveBeenCalledWith('路由错误')
    expect(wrapper.vm.callState).toBe('')
    expect(wrapper.vm.isOutgoingCall).toBe(false)
    expect(wrapper.vm.messages.some(message => message.content.includes('3002'))).toBe(true)
  })

  it('handles a rejected HTTP request without an unhandled rejection', async () => {
    // Attach a handler here too so the original fire-and-forget implementation
    // produces assertion failures rather than polluting the runner.
    const rejection = Promise.reject(new Error('网络连接失败'))
    rejection.catch(() => {})
    sdk.makeCall.mockReturnValue(rejection)
    await wrapper.vm.handleMakeCall()
    await flushPromises()
    expect(ElMessage.error).toHaveBeenCalledWith('网络连接失败')
    expect(wrapper.vm.callState).toBe('')
    expect(wrapper.vm.isOutgoingCall).toBe(false)
  })
})

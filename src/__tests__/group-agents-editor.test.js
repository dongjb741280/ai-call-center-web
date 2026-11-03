import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus, { ElSelect, ElMessage } from 'element-plus'
import Editor from '@/components/GroupAgentsEditor.vue'
import * as api from '@/api/config'
vi.mock('@/api/config', () => ({ getGroupAgents: vi.fn(), getAgentConfigList: vi.fn(), getAgentConfigDetail: vi.fn(), getGroupConfigList: vi.fn(), updateAgentGroups: vi.fn() }))
vi.mock('element-plus', async original => ({ ...await original(), ElMessage: { error: vi.fn(), success: vi.fn() } }))
let wrapper
const click = async label => { await wrapper.findAll('button').find(b => b.text() === label).trigger('click'); await flushPromises() }
beforeEach(async () => {
  vi.clearAllMocks()
  api.getGroupAgents.mockResolvedValue({ code: 0, data: [{ agentKey: '1001@test', isPrimary: 1 }] })
  api.getAgentConfigList.mockResolvedValue({ code: 0, data: { list: [{ id: 7, agentKey: '1001@test' }], total: 1 } })
  api.getGroupConfigList.mockResolvedValue({ code: 0, data: { list: [{ id: 10, name: '售前' }, { id: 20, name: '售后' }], total: 2 } })
  api.getAgentConfigDetail.mockResolvedValue({ code: 0, data: { id: 7, agentKey: '1001@test', groupIds: [10, 20], groupId: 10 } })
  api.updateAgentGroups.mockResolvedValue({ code: 0 })
  wrapper = mount(Editor, { props: { groupId: 10 }, global: { plugins: [ElementPlus], stubs: { teleport: true, ElDialog: { template: '<div><slot /><slot name="footer" /></div>' } } } })
  await flushPromises()
})
afterEach(() => wrapper.unmount())
it('移出主技能组时必须选择替代组，保留其他组关系', async () => {
  await click('移出')
  await click('保存坐席关系')
  expect(api.updateAgentGroups).not.toHaveBeenCalled()
  expect(ElMessage.error).toHaveBeenCalled()
  await wrapper.findComponent(ElSelect).vm.$emit('update:modelValue', 20)
  await click('保存坐席关系')
  expect(api.updateAgentGroups).toHaveBeenCalledWith(7, { groupIds: [20], groupId: 20 })
})
it('设为主技能组时保留其他组关系', async () => {
  api.getAgentConfigDetail.mockResolvedValue({ code: 0, data: { id: 7, groupIds: [10, 20], groupId: 20 } })
  await click('设置主技能组')
  await click('保存坐席关系')
  expect(api.updateAgentGroups).toHaveBeenCalledWith(7, { groupIds: [10, 20], groupId: 10 })
})
it('详情读取失败不会保存空关系', async () => {
  api.getAgentConfigDetail.mockRejectedValue(new Error('加载失败'))
  await click('移出')
  expect(wrapper.findAll('button').find(b => b.text() === '保存坐席关系').attributes('disabled')).toBeDefined()
  expect(api.updateAgentGroups).not.toHaveBeenCalled()
})

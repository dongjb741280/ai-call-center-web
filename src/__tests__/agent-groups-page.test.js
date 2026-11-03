import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus, { ElDialog, ElSelect, ElInputNumber, ElMessage } from 'element-plus'
import AgentList from '@/views/agent/List.vue'
import * as api from '@/api/config'

vi.mock('@/api/config', () => ({
  getAgentConfigList: vi.fn(), getAgentConfigDetail: vi.fn(), getGroupConfigList: vi.fn(), getSkillList: vi.fn(),
  updateAgentGroups: vi.fn(), addAgentConfig: vi.fn(), updateAgentConfig: vi.fn(),
  deleteAgentConfig: vi.fn(), batchAddAgents: vi.fn()
}))

vi.mock('element-plus', async importOriginal => {
  const original = await importOriginal()
  return { ...original, ElMessage: { success: vi.fn(), error: vi.fn() } }
})

let wrapper
let saved

const button = (scope, label) => scope.findAll('button').find(item => item.text() === label)
const groupDialog = () => wrapper.findAllComponents(ElDialog).find(dialog => dialog.props('title') === '坐席技能组')
const openGroups = async () => {
  await button(wrapper, '技能组').trigger('click')
  await flushPromises()
  return groupDialog()
}

beforeEach(async () => {
  vi.clearAllMocks()
  saved = { groupIds: [10, 20], groupId: 10 }
  api.getAgentConfigList.mockImplementation(async () => ({ code: 0, data: {
    list: [{ id: 7, agentKey: '1001@example', groupId: saved.groupId }], total: 1
  } }))
  api.getGroupConfigList.mockResolvedValue({ code: 0, data: {
    list: [{ id: 10, name: '售前' }, { id: 20, name: '售后' }], total: 2
  } })
  api.getAgentConfigDetail.mockImplementation(async () => ({ code: 0, data: { ...saved } }))
  api.getSkillList.mockResolvedValue({ code: 0, data: { list: [{ id: 30, name: '咨询' }], total: 1 } })
  api.updateAgentGroups.mockImplementation(async (_id, payload) => {
    saved = payload
    return { code: 0, data: payload.groupIds.length }
  })
  wrapper = mount(AgentList, { global: {
    plugins: [ElementPlus],
    stubs: { Plus: true, Download: true, Search: true, Refresh: true }
  } })
  await flushPromises()
})

afterEach(() => wrapper?.unmount())

describe('坐席技能组管理交互', () => {
  it('编辑读取完整详情，并一次提交基础信息、技能组和坐席技能', async () => {
    api.getAgentConfigDetail.mockResolvedValue({ code: 0, data: {
      id: 7, agentId: '1001', agentKey: '1001@example', agentName: '客服一',
      groupIds: [10, 20], groupId: 20, skillAgents: [{ skillId: 30, rankValue: 50 }]
    } })
    api.updateAgentConfig.mockResolvedValue({ code: 0 })
    await button(wrapper, '编辑').trigger('click')
    await flushPromises()
    const dialog = wrapper.findAllComponents(ElDialog).find(item => item.props('title') === '编辑坐席')
    expect(dialog.text()).toContain('坐席技能')
    expect(dialog.text()).toContain('技能等级（1-100）')
    const primary = dialog.findAllComponents(ElSelect).find(select => select.props('placeholder') === '从所属技能组中选择')
    await primary.vm.$emit('update:modelValue', 10)
    const rank = dialog.findAllComponents(ElInputNumber).find(input => input.props('modelValue') === 50)
    await rank.vm.$emit('update:modelValue', 80)
    await button(dialog, '保存').trigger('click')
    await flushPromises()
    expect(api.updateAgentConfig).toHaveBeenCalledWith(7, expect.objectContaining({
      agentId: '1001', agentName: '客服一',
      groups: { groupIds: [10, 20], groupId: 10 },
      skillAgents: [{ skillId: 30, rankValue: 80 }]
    }))
    expect(api.updateAgentConfig.mock.calls[0][1]).not.toHaveProperty('passwd')
  })

  it('编辑详情加载失败时禁止保存，不使用列表中的简略数据覆盖关系', async () => {
    api.getAgentConfigDetail.mockRejectedValue(new Error('加载失败'))
    await button(wrapper, '编辑').trigger('click')
    await flushPromises()
    const dialog = wrapper.findAllComponents(ElDialog).find(item => item.props('title') === '编辑坐席')
    expect(button(dialog, '保存').attributes('disabled')).toBeDefined()
    expect(api.updateAgentConfig).not.toHaveBeenCalled()
  })

  it('读取所属组和主组，更换主组后保存并重新打开回显', async () => {
    const dialog = await openGroups()
    const selects = dialog.findAllComponents(ElSelect)
    expect(selects[0].props('modelValue')).toEqual([10, 20])
    expect(selects[1].props('modelValue')).toBe(10)
    await selects[1].vm.$emit('update:modelValue', 20)
    await button(dialog, '保存').trigger('click')
    await flushPromises()
    expect(api.updateAgentGroups).toHaveBeenCalledWith(7, { groupIds: [10, 20], groupId: 20 })
    expect(api.getAgentConfigList).toHaveBeenCalledTimes(2)
    const reopened = await openGroups()
    expect(reopened.findAllComponents(ElSelect)[1].props('modelValue')).toBe(20)
  })

  it('主组被移出所属组后阻止保存，直到重新指定主组', async () => {
    const dialog = await openGroups()
    const selects = dialog.findAllComponents(ElSelect)
    await selects[0].vm.$emit('update:modelValue', [20])
    await selects[0].vm.$emit('change', [20])
    expect(selects[1].props('modelValue')).toBeNull()
    await button(dialog, '保存').trigger('click')
    expect(api.updateAgentGroups).not.toHaveBeenCalled()
    expect(ElMessage.error).toHaveBeenCalledWith('请选择所属技能组中的一个作为主技能组')
  })

  it('业务失败时保留弹窗及选择，不提示保存成功', async () => {
    api.updateAgentGroups.mockResolvedValue({ code: 1006, message: '技能组已被删除' })
    const dialog = await openGroups()
    await button(dialog, '保存').trigger('click')
    await flushPromises()
    expect(dialog.props('modelValue')).toBe(true)
    expect(ElMessage.error).toHaveBeenCalledWith('技能组已被删除')
    expect(ElMessage.success).not.toHaveBeenCalled()
  })

  it('详情加载失败时禁止保存，避免以空关系覆盖原数据', async () => {
    api.getAgentConfigDetail.mockRejectedValue(new Error('加载失败'))
    const dialog = await openGroups()
    expect(button(dialog, '保存').attributes('disabled')).toBeDefined()
    expect(api.updateAgentGroups).not.toHaveBeenCalled()
  })
})

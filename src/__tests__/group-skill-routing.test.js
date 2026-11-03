import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus, { ElMessage } from 'element-plus'
import Groups from '@/views/agent/Groups.vue'
import * as api from '@/api/config'

vi.mock('@/api/config', () => ({
  getGroupConfigList: vi.fn(), getGroupConfigDetail: vi.fn(), getGroupAgents: vi.fn(), getSkillList: vi.fn(),
  addGroupConfig: vi.fn(), updateGroupSkills: vi.fn(), deleteGroupConfig: vi.fn()
}))
vi.mock('element-plus', async original => ({ ...await original(), ElMessage: { success: vi.fn(), error: vi.fn() }, ElMessageBox: { confirm: vi.fn() } }))
vi.mock('@/components/GroupAgentsEditor.vue', () => ({ default: { template: '<div />' } }))

let wrapper
const click = async label => {
  const button = wrapper.findAll('button').find(item => item.text().trim() === label)
  await button.trigger('click')
  await flushPromises()
}

beforeEach(async () => {
  vi.clearAllMocks()
  api.getGroupConfigList.mockResolvedValue({ code: 0, data: { list: [{ id: 10, name: '售后组' }], total: 1 } })
  api.getGroupConfigDetail.mockResolvedValue({ code: 0, data: {
    id: 10, name: '售后组', skills: [{ skillId: 30, levelValue: 1, rankType: 3, rankValue: 70, rankValueStart: 1, matchType: 2, shareValue: 80 }]
  } })
  api.getGroupAgents.mockResolvedValue({ code: 0, data: [] })
  api.getSkillList.mockResolvedValue({ code: 0, data: { list: [{ id: 30, name: '退款处理' }], total: 1 } })
  api.updateGroupSkills.mockResolvedValue({ code: 0 })
  wrapper = mount(Groups, { global: {
    plugins: [ElementPlus],
    stubs: { ElDialog: { template: '<div><slot /><slot name="footer" /></div>' }, Plus: true, Search: true, Refresh: true }
  } })
  await flushPromises()
})
afterEach(() => wrapper.unmount())

it('技能组编辑使用技能ID和真实等级规则字段独立保存路由技能', async () => {
  await click('编辑')
  expect(wrapper.text()).toContain('退款处理')
  await click('保存技能路由')
  expect(api.updateGroupSkills).toHaveBeenCalledWith(10, { skillList: [{
    skillId: 30, levelValue: 1, rankType: 3, rankValue: 70, rankValueStart: 1, matchType: 2, shareValue: 80
  }] })
  expect(ElMessage.success).toHaveBeenCalledWith('技能路由配置已保存')
})

it('技能路由保存失败时保留编辑并显示后端错误', async () => {
  api.updateGroupSkills.mockResolvedValue({ code: 1006, message: '技能已停用' })
  await click('编辑')
  await click('保存技能路由')
  expect(ElMessage.error).toHaveBeenCalledWith('技能已停用')
  expect(ElMessage.success).not.toHaveBeenCalled()
})

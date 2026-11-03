import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus, { ElInput, ElInputNumber, ElSelect, ElMessage } from 'element-plus'
import Skills from '@/views/admin/Skills.vue'
import * as api from '@/api/config'
vi.mock('@/api/config', () => ({ getSkillList: vi.fn(), getSkillDetail: vi.fn(), addSkill: vi.fn(), updateSkill: vi.fn(), deleteSkill: vi.fn(), getAgentConfigList: vi.fn(), addSkillAgent: vi.fn(), updateSkillAgent: vi.fn(), deleteSkillAgent: vi.fn() }))
vi.mock('element-plus', async original => ({ ...await original(), ElMessage: { success: vi.fn(), error: vi.fn() }, ElMessageBox: { confirm: vi.fn().mockResolvedValue(true) } }))
let wrapper
const button = label => wrapper.findAll('button').find(b => b.text() === label)
const click = async label => { await button(label).trigger('click'); await flushPromises() }
beforeEach(async () => {
  vi.clearAllMocks()
  api.getSkillList.mockResolvedValue({ code: 0, data: { list: [{ id: 30, name: '退款处理', remark: '售后能力' }], total: 1 } })
  api.getSkillDetail.mockResolvedValue({ code: 0, data: { id: 30, name: '退款处理', skillAgents: [{ id: 999, skillId: 30, agentId: 7, rankValue: 80 }] } })
  api.getAgentConfigList.mockResolvedValue({ code: 0, data: { list: [{ id: 7, agentKey: '1001@test', agentName: '客服一' }, { id: 8, agentKey: '1002@test', agentName: '客服二' }], total: 2 } })
  for (const name of ['addSkill', 'updateSkill', 'deleteSkill', 'addSkillAgent', 'updateSkillAgent', 'deleteSkillAgent']) api[name].mockResolvedValue({ code: 0 })
  wrapper = mount(Skills, { global: { plugins: [ElementPlus], stubs: { ElDialog: { template: '<div><slot /><slot name="footer" /></div>' } } } })
  await flushPromises()
})
afterEach(() => wrapper.unmount())
it('技能字典直接显示独立技能，坐席详情使用技能ID', async () => {
  expect(wrapper.text()).toContain('退款处理')
  await click('退款处理')
  expect(api.getSkillDetail).toHaveBeenCalledWith(30)
  expect(wrapper.text()).toContain('客服一')
  expect(wrapper.text()).toContain('80')
  expect(wrapper.text()).not.toContain('占用率')
})
it('新增技能只发送名称与备注', async () => {
  await click('新增技能')
  const inputs = wrapper.findAllComponents(ElInput)
  await wrapper.find('input[maxlength="16"]').setValue('英语服务')
  await inputs.find(i => i.props('type') === 'textarea').vm.$emit('update:modelValue', '英文支持')
  await click('保存技能')
  expect(api.addSkill).toHaveBeenCalledWith({ name: '英语服务', remark: '英文支持' })
})
it('修改坐席等级使用技能ID和坐席ID', async () => {
  await click('退款处理'); await click('编辑等级')
  const inputs = wrapper.findAllComponents(ElInputNumber)
  await inputs[inputs.length - 1].vm.$emit('update:modelValue', 90)
  await click('保存坐席技能')
  expect(api.updateSkillAgent).toHaveBeenCalledWith(30, { agentId: 7, rankValue: 90 })
})
it('移除发送技能ID和坐席ID数组，不发送关联记录ID', async () => {
  await click('退款处理'); await click('移除')
  expect(api.deleteSkillAgent).toHaveBeenCalledWith(30, { agentIds: [7] })
})
it('添加坐席仅提供未绑定候选并提交等级', async () => {
  await click('退款处理'); await click('添加坐席')
  const select = wrapper.findComponent(ElSelect)
  expect(select.text()).not.toContain('客服一')
  await select.vm.$emit('update:modelValue', [8])
  await click('保存坐席技能')
  expect(api.addSkillAgent).toHaveBeenCalledWith(30, { agentIds: [8], rankValue: 50 })
})
it('业务失败不显示保存成功，也不刷新关系', async () => {
  await click('退款处理'); await click('编辑等级')
  api.updateSkillAgent.mockResolvedValue({ code: 1006, message: '技能已删除' })
  await click('保存坐席技能')
  expect(ElMessage.error).toHaveBeenCalledWith('技能已删除')
  expect(ElMessage.success).not.toHaveBeenCalled()
  expect(api.getSkillDetail).toHaveBeenCalledTimes(1)
})

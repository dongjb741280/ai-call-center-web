import { describe, it, expect } from 'vitest'
import SHA256 from 'crypto-js/sha256'
import { createAgentForm, buildAgentPayload } from '@/utils/agentEditor'

describe('坐席编辑请求', () => {
  it('使用详情字段回显，并避免表单编辑直接修改详情数据', () => {
    const detail = { id: 7, agentId: '1001', agentCode: '8001', sipPhone: '13800000000', afterInterval: 0,
      groupIds: [10], groupId: 10, skillAgents: [{ skillId: 30, rankValue: 50 }] }
    const form = createAgentForm(detail)
    expect(form.agentCode).toBe('8001')
    expect(form.afterInterval).toBe(0)
    form.groups.groupIds.push(20)
    form.skillAgents[0].rankValue = 80
    expect(detail.groupIds).toEqual([10])
    expect(detail.skillAgents[0].rankValue).toBe(50)
  })

  it('编辑时密码留空保留原密码；更改密码时按登录契约发送SHA256', () => {
    const form = createAgentForm({ id: 7, agentId: '1001' })
    expect(buildAgentPayload(form)).not.toHaveProperty('passwd')
    form.passwd = 'example-pass'
    expect(buildAgentPayload(form).passwd).toBe(SHA256('example-pass').toString())
  })

  it('新增必须填写密码', () => {
    expect(() => buildAgentPayload(createAgentForm())).toThrow('请输入坐席密码')
  })

  it('主动清空技能时提交空数组，以便删除已有关系', () => {
    const form = createAgentForm({ id: 7, skillAgents: [{ skillId: 30, rankValue: 50 }] })
    form.skillAgents = []
    expect(buildAgentPayload(form).skillAgents).toEqual([])
  })

  it.each([
    [{ skillId: 30, rankValue: 50 }, { skillId: 30, rankValue: 60 }],
    [{ skillId: null, rankValue: 50 }],
    [{ skillId: 30, rankValue: 0 }],
    [{ skillId: 30, rankValue: 101 }]
  ])('保存前拒绝重复、未选择或等级不合法的技能配置：%j', (...skills) => {
    const form = createAgentForm({ id: 7 })
    form.skillAgents = skills
    expect(() => buildAgentPayload(form)).toThrow()
  })
})

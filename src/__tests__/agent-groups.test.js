import { describe, it, expect } from 'vitest'
import { buildAgentGroupsPayload, getAgentGroupRows } from '@/utils/agentGroups'

describe('坐席主技能组关系', () => {
  it('回显所有所属组，并仅标记接口指定的主组', () => {
    expect(getAgentGroupRows({ groupIds: [10, 20], groupId: 20 }, [
      { id: 10, name: '售前', levelValue: 1 }, { id: 20, name: '售后', levelValue: 2 }
    ])).toEqual([
      { id: 10, name: '售前', levelValue: 1, isPrimary: 0 },
      { id: 20, name: '售后', levelValue: 2, isPrimary: 1 }
    ])
  })

  it('不将第一个所属组自动作为主组', () => {
    expect(getAgentGroupRows({ groupIds: [10, 20], groupId: null }).map(group => group.isPrimary)).toEqual([0, 0])
  })

  it('兼容筛选输入的字符串 ID，并保留未知组以免编辑时丢失关系', () => {
    expect(getAgentGroupRows({ groupIds: [10, 20], groupId: '20' }, [{ id: '10', name: '售前' }])).toEqual([
      { id: 10, name: '售前', levelValue: undefined, isPrimary: 0 },
      { id: 20, name: '技能组 20', levelValue: undefined, isPrimary: 1 }
    ])
  })

  it('更换主组时保留其他所属组，并仅提交关系接口所需字段', () => {
    expect(buildAgentGroupsPayload({ groupIds: [10, 20], groupId: 20, agentKey: '1001', passwd: 'unused' }))
      .toEqual({ groupIds: [10, 20], groupId: 20 })
  })

  it.each([
    { groupIds: [10, 20], groupId: null },
    { groupIds: [10], groupId: 20 },
    { groupIds: [10, '10'], groupId: 10 },
    { groupIds: [null], groupId: null },
    { groupIds: null, groupId: null }
  ])('拒绝未选择主组、已移出所属组的主组及无效关系：%j', form => {
    expect(() => buildAgentGroupsPayload(form)).toThrow()
  })

  it('移除全部所属组时同时清空主组', () => {
    expect(buildAgentGroupsPayload({ groupIds: [], groupId: 20 })).toEqual({ groupIds: [], groupId: null })
  })
})

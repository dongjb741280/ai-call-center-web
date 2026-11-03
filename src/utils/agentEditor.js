import SHA256 from 'crypto-js/sha256'
import { buildAgentGroupsPayload } from './agentGroups'

export const createAgentForm = (agent = {}) => ({
  id: agent.id ?? null,
  agentId: agent.agentId || agent.agentKey?.split('@')[0] || '',
  agentKey: agent.agentKey || '',
  agentName: agent.agentName || '',
  passwd: '',
  agentCode: agent.agentCode || '',
  sipPhone: agent.sipPhone || '',
  agentType: agent.agentType ?? 1,
  afterInterval: agent.afterInterval ?? 5,
  display: agent.display || '',
  ringTime: agent.ringTime ?? 30,
  record: agent.record ?? 0,
  status: agent.status ?? 1,
  cts: agent.cts,
  uts: agent.uts,
  state: agent.state,
  groups: { groupIds: [...(agent.groupIds || [])], groupId: agent.groupId ?? null },
  skillAgents: (agent.skillAgents || []).map(skill => ({ skillId: skill.skillId, rankValue: skill.rankValue }))
})

export const buildAgentPayload = (form) => {
  if (!form.id && !form.passwd) throw new Error('请输入坐席密码')
  const skills = form.skillAgents
  if (skills.length > 20) throw new Error('坐席技能不能超过20个')
  if (new Set(skills.map(skill => String(skill.skillId))).size !== skills.length) throw new Error('不能重复添加同一技能')
  if (skills.some(skill => skill.skillId == null || !Number.isInteger(skill.rankValue) || skill.rankValue < 1 || skill.rankValue > 100)) {
    throw new Error('请选择技能，并填写1-100之间的技能等级')
  }
  return {
    agentId: form.agentId,
    agentName: form.agentName,
    agentCode: form.agentCode,
    sipPhone: form.sipPhone,
    agentType: form.agentType,
    afterInterval: form.afterInterval,
    display: form.display,
    ringTime: form.ringTime,
    record: form.record,
    status: form.status,
    loginType: 1,
    ...(form.passwd ? { passwd: SHA256(form.passwd).toString() } : {}),
    groups: buildAgentGroupsPayload(form.groups),
    skillAgents: skills.map(({ skillId, rankValue }) => ({ skillId, rankValue }))
  }
}

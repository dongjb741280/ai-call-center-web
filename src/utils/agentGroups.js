export const buildAgentGroupsPayload = ({ groupIds, groupId }) => {
  if (!Array.isArray(groupIds) || new Set(groupIds.map(String)).size !== groupIds.length || groupIds.some(id => id == null)) {
    throw new Error('所属技能组无效')
  }
  if (groupIds.length && (groupId == null || !groupIds.some(id => String(id) === String(groupId)))) {
    throw new Error('请选择所属技能组中的一个作为主技能组')
  }
  return { groupIds: [...groupIds], groupId: groupIds.length ? groupId : null }
}

export const getAgentGroupRows = (agent, options = []) => {
  if (!agent) return []
  return (agent.groupIds || []).map(id => {
    const group = options.find(option => String(option.id) === String(id))
    return {
      id,
      name: group?.name || `技能组 ${id}`,
      levelValue: group?.levelValue,
      isPrimary: agent.groupId != null && String(id) === String(agent.groupId) ? 1 : 0
    }
  })
}

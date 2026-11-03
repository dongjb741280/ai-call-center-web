<template>
  <el-card shadow="never" class="detail-card" v-loading="loading">
    <template #header>
      <div class="card-header-row"><span>坐席列表（{{ members.length }}）</span><el-button type="primary" size="small" :disabled="!loaded" @click="openAdd">添加坐席</el-button></div>
    </template>
    <el-alert title="坐席关系单独保存，保存后立即生效；呼叫配置在坐席重新登录后更新。" type="info" :closable="false" show-icon />
    <el-table :data="members" size="small" max-height="300">
      <el-table-column prop="agentKey" label="坐席账号" />
      <el-table-column label="坐席名称"><template #default="{ row }">{{ row.agent?.agentName || row.agent?.name || row.agentName || '-' }}</template></el-table-column>
      <el-table-column label="主技能组"><template #default="{ row }"><el-tag :type="Number(row.isPrimary) === 1 ? 'success' : 'info'">{{ Number(row.isPrimary) === 1 ? '是' : '否' }}</el-tag></template></el-table-column>
      <el-table-column label="操作" width="200"><template #default="{ row }"><el-button link type="primary" :disabled="busy" @click="openMember(row, false)">设置主技能组</el-button><el-button link type="danger" :disabled="busy" @click="openMember(row, true)">移出</el-button></template></el-table-column>
    </el-table>
    <el-dialog v-model="visible" :title="removing ? '移出坐席' : '配置坐席技能组'" width="520px" append-to-body :close-on-click-modal="false">
      <el-form label-width="100px">
        <el-form-item v-if="adding" label="坐席"><el-select v-model="selectedId" filterable style="width:100%" @change="loadAgent"><el-option v-for="agent in candidates" :key="agent.id" :value="agent.id" :label="`${agent.agentName || agent.agentId || ''} (${agent.agentKey || agent.agentId})`" /></el-select></el-form-item>
        <el-form-item v-else label="坐席">{{ selectedAgent?.agentName || selectedAgent?.agentKey }}</el-form-item>
        <el-form-item label="主技能组"><el-select v-model="primaryId" :disabled="!selectedAgent || busy || !remainingIds.length" style="width:100%" placeholder="请选择保留的主技能组"><el-option v-for="id in remainingIds" :key="id" :value="id" :label="groups.find(g => String(g.id) === String(id))?.name || `技能组 ${id}`" /></el-select></el-form-item>
        <el-alert v-if="removing" title="仅移出当前技能组，其他技能组关系保留。" type="warning" :closable="false" />
      </el-form>
      <template #footer><el-button :disabled="busy" @click="visible = false">取消</el-button><el-button type="primary" :loading="busy" :disabled="!selectedAgent" @click="save">保存坐席关系</el-button></template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getGroupAgents, getAgentConfigList, getAgentConfigDetail, getGroupConfigList, updateAgentGroups } from '@/api/config'
import { buildAgentGroupsPayload } from '@/utils/agentGroups'
const props = defineProps({ groupId: { type: Number, required: true } })
const members = ref([]), groups = ref([]), candidates = ref([])
const loading = ref(false), loaded = ref(false), busy = ref(false), visible = ref(false)
const adding = ref(false), removing = ref(false), selectedId = ref(null), selectedAgent = ref(null), primaryId = ref(null)
const check = res => { if (res.code !== 0) throw new Error(res.message || '加载失败'); return res.data }
const allPages = async api => {
  const rows = []
  for (let pageNum = 1; ; pageNum++) {
    const data = check(await api({ pageNum, pageSize: 100 }))
    const page = data?.list || []
    rows.push(...page)
    if (!page.length || rows.length >= (data?.total ?? rows.length)) return rows
  }
}
const refresh = async () => { members.value = check(await getGroupAgents(props.groupId)) || [] }
const remainingIds = computed(() => {
  const ids = selectedAgent.value?.groupIds || []
  if (removing.value) return ids.filter(id => String(id) !== String(props.groupId))
  return ids.some(id => String(id) === String(props.groupId)) ? [...ids] : [...ids, props.groupId]
})
const loadAgent = async id => {
  selectedAgent.value = null
  busy.value = true
  try {
    const agent = check(await getAgentConfigDetail(id))
    if (!agent?.id) throw new Error('坐席详情加载失败')
    selectedAgent.value = agent
    primaryId.value = agent.groupId
    if (removing.value && String(agent.groupId) === String(props.groupId)) primaryId.value = null
    if (!removing.value) primaryId.value = props.groupId
  } catch (e) { ElMessage.error(e.message || '加载坐席失败') }
  finally { busy.value = false }
}
const openAdd = async () => {
  loading.value = true
  try {
    const agents = await allPages(getAgentConfigList)
    candidates.value = agents.filter(a => !members.value.some(m => String(m.agentKey) === String(a.agentKey)))
    adding.value = true; removing.value = false; selectedId.value = null; selectedAgent.value = null; primaryId.value = null; visible.value = true
  } catch (e) { ElMessage.error(e.message || '加载坐席失败') }
  finally { loading.value = false }
}
const openMember = async (row, remove) => {
  loading.value = true
  try {
    const agents = await allPages(getAgentConfigList)
    const agent = agents.find(a => String(a.agentKey) === String(row.agentKey))
    if (!agent) throw new Error('未找到坐席，请刷新后重试')
    adding.value = false; removing.value = remove; visible.value = true
    await loadAgent(agent.id)
  } catch (e) { ElMessage.error(e.message || '加载坐席失败') }
  finally { loading.value = false }
}
const save = async () => {
  let payload
  try { payload = buildAgentGroupsPayload({ groupIds: remainingIds.value, groupId: remainingIds.value.length ? primaryId.value : null }) }
  catch (e) { ElMessage.error(e.message); return }
  busy.value = true
  try {
    check(await updateAgentGroups(selectedAgent.value.id, payload))
    visible.value = false
    ElMessage.success('坐席关系已保存')
    await refresh()
  } catch (e) { ElMessage.error(e.message || '保存或刷新失败，请刷新列表确认') }
  finally { busy.value = false }
}
onMounted(async () => {
  loading.value = true
  try { await refresh(); groups.value = await allPages(getGroupConfigList); loaded.value = true }
  catch (e) { ElMessage.error(e.message || '加载坐席列表失败') }
  finally { loading.value = false }
})
</script>
<style scoped>
.detail-card { margin-bottom: 16px; }
.card-header-row { display: flex; align-items: center; justify-content: space-between; }
</style>

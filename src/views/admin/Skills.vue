<template>
  <div class="page-card">
    <div class="page-header"><h2>技能</h2><el-button type="primary" @click="openSkill()">新增技能</el-button></div>
    <el-alert title="技能是独立的能力字典，可被多个技能组使用。此处维护坐席技能等级；组级匹配规则请在技能组中配置。" type="info" :closable="false" show-icon />
    <div class="skill-layout">
      <el-card shadow="never" class="left-panel" v-loading="loading">
        <template #header>技能字典（{{ skills.length }}）</template>
        <el-input v-model="skillKeyword" placeholder="搜索技能名称" clearable />
        <div v-for="skill in filteredSkills" :key="skill.id" class="skill-row" :class="{ active: selectedSkill?.id === skill.id }">
          <div class="skill-label"><el-button link @click="selectSkill(skill)">{{ skill.name }}</el-button><el-tag size="small" :type="skillBindings[skill.id]?.length ? 'success' : bindingsLoaded ? 'warning' : 'info'">{{ skillBindings[skill.id]?.length ? `${skillBindings[skill.id].length} 个技能组` : bindingsLoaded ? '未用于路由' : '绑定状态未知' }}</el-tag></div>
          <div><el-button link type="primary" @click="openSkill(skill)">编辑</el-button><el-button link type="danger" :disabled="submitLoading" @click="removeSkill(skill)">删除</el-button></div>
        </div>
        <el-empty v-if="!filteredSkills.length && !loading" description="暂无技能" />
      </el-card>
      <el-card shadow="never" class="right-panel" v-loading="agentLoading">
        <template #header><div class="card-header-row"><span>{{ selectedSkill ? `${selectedSkill.name} · 坐席列表` : '坐席列表' }}</span><el-button type="primary" :disabled="!selectedSkill || agentLoading || submitLoading" @click="openAgent()">添加坐席</el-button></div></template>
        <template v-if="selectedSkill">
          <div class="binding-info"><span>路由技能组：</span><template v-if="bindingsLoaded"><el-tag v-for="group in (skillBindings[selectedSkill.id] || [])" :key="group.id" size="small">{{ group.name }}</el-tag><span v-if="!skillBindings[selectedSkill.id]?.length">未绑定技能组，当前不会参与 VDN 路由</span></template><span v-else>绑定状态暂不可用</span></div>
          <p class="remark">{{ selectedSkill.remark || '暂无备注' }}</p>
          <div class="agent-search">
            <el-input v-model="keyword" placeholder="搜索坐席账号或名称" clearable />
            <el-input-number v-model="rankFilter" :min="1" :max="100" :precision="0" placeholder="技能等级" />
            <el-button @click="keyword = ''; rankFilter = undefined">重置</el-button>
          </div>
          <el-table :data="filteredAgents" size="small" max-height="500">
            <el-table-column prop="agentKey" label="坐席账号" min-width="150" />
            <el-table-column prop="agentName" label="坐席名称" min-width="110" />
            <el-table-column prop="rankValue" label="技能等级（1–100）" width="150" />
            <el-table-column label="操作" width="160"><template #default="{ row }"><el-button link type="primary" :disabled="submitLoading" @click="openAgent(row)">编辑等级</el-button><el-button link type="danger" :disabled="submitLoading" @click="removeAgent(row)">移除</el-button></template></el-table-column>
          </el-table>
          <p class="remark">共 {{ filteredAgents.length }} 个坐席。技能变更在坐席重新登录后更新呼叫配置。</p>
        </template>
        <el-empty v-else description="请从左侧选择技能" />
      </el-card>
    </div>
    <el-dialog v-model="skillVisible" :title="skillForm.id ? '编辑技能' : '新增技能'" width="480px" :close-on-click-modal="false" :before-close="closeSkill">
      <el-form label-width="90px">
        <el-form-item label="技能名称" required><el-input v-model="skillForm.name" maxlength="16" show-word-limit /></el-form-item>
        <el-form-item label="备注"><el-input v-model="skillForm.remark" type="textarea" maxlength="100" show-word-limit /></el-form-item>
      </el-form>
      <template #footer><el-button :disabled="submitLoading" @click="skillVisible = false">取消</el-button><el-button type="primary" :loading="submitLoading" @click="saveSkill">保存技能</el-button></template>
    </el-dialog>
    <el-dialog v-model="agentVisible" :title="agentForm.agentId ? '编辑技能等级' : '添加坐席'" width="480px" :close-on-click-modal="false" :before-close="closeAgent">
      <el-form label-width="100px">
        <el-form-item label="坐席" required>
          <span v-if="agentForm.agentId">{{ agentForm.agentKey }}</span>
          <el-select v-else v-model="agentForm.agentIds" multiple filterable placeholder="请选择坐席" style="width:100%"><el-option v-for="agent in candidates" :key="agent.id" :value="agent.id" :label="`${agent.agentName || agent.agentId || ''} (${agent.agentKey || agent.agentId})`" /></el-select>
        </el-form-item>
        <el-form-item label="技能等级" required><el-input-number v-model="agentForm.rankValue" :min="1" :max="100" :precision="0" /></el-form-item>
      </el-form>
      <template #footer><el-button :disabled="submitLoading" @click="agentVisible = false">取消</el-button><el-button type="primary" :loading="submitLoading" @click="saveAgent">保存坐席技能</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getSkillList, getSkillDetail, addSkill, updateSkill, deleteSkill, getAgentConfigList, addSkillAgent, updateSkillAgent, deleteSkillAgent, getGroupConfigList, getGroupConfigDetail } from '@/api/config'
const loading = ref(false), agentLoading = ref(false), submitLoading = ref(false)
const skills = ref([]), selectedSkill = ref(null), agents = ref([]), candidates = ref([]), skillBindings = reactive({})
const skillKeyword = ref(''), keyword = ref(''), rankFilter = ref()
const skillVisible = ref(false), agentVisible = ref(false)
const bindingsLoaded = ref(false)
const skillForm = reactive({ id: null, name: '', remark: '' })
const agentForm = reactive({ agentId: null, agentKey: '', agentIds: [], rankValue: 50 })
let selectionVersion = 0
const check = res => { if (res.code !== 0) throw new Error(res.message || '操作失败'); return res.data }
const error = e => ElMessage.error(e.message || '操作失败')
const allPages = async api => {
  const list = []
  for (let pageNum = 1; ; pageNum++) {
    const data = check(await api({ pageNum, pageSize: 100, query: '{}' }))
    const rows = data?.list || []
    list.push(...rows)
    if (!rows.length || list.length >= (data?.total ?? list.length)) return list
  }
}
const filteredSkills = computed(() => skills.value.filter(s => s.name?.includes(skillKeyword.value.trim())))
const filteredAgents = computed(() => agents.value.filter(a => (!keyword.value || `${a.agentKey || ''} ${a.agentName || ''}`.includes(keyword.value.trim())) && (rankFilter.value == null || rankFilter.value === a.rankValue)))
const loadSkills = async () => {
  loading.value = true
  try {
    skills.value = await allPages(getSkillList)
    bindingsLoaded.value = false
    const groups = await allPages(getGroupConfigList)
    const details = await Promise.all(groups.map(group => getGroupConfigDetail(group.id)))
    Object.keys(skillBindings).forEach(id => delete skillBindings[id])
    details.forEach((res, index) => {
      if (res.code !== 0) throw new Error(res.message || '技能组绑定状态加载失败')
      ;(res.data?.skills || []).forEach(binding => {
        if (!skillBindings[binding.skillId]) skillBindings[binding.skillId] = []
        skillBindings[binding.skillId].push({ id: groups[index].id, name: groups[index].name })
      })
    })
    bindingsLoaded.value = true
  } catch (e) { bindingsLoaded.value = false; error(e) }
  finally { loading.value = false }
}
const selectSkill = async skill => {
  if (submitLoading.value || agentVisible.value) return
  const version = ++selectionVersion
  selectedSkill.value = skill; agents.value = []; agentLoading.value = true
  keyword.value = ''; rankFilter.value = undefined
  try {
    const [detailRes, directory] = await Promise.all([getSkillDetail(skill.id), allPages(getAgentConfigList)])
    const detail = check(detailRes)
    if (version !== selectionVersion) return
    selectedSkill.value = detail
    agents.value = (detail.skillAgents || []).map(row => {
      const agent = directory.find(a => String(a.id) === String(row.agentId))
      return { ...row, agentKey: agent?.agentKey || row.agentKey, agentName: agent?.agentName || '-' }
    })
    candidates.value = directory.filter(a => !agents.value.some(row => String(row.agentId) === String(a.id)))
  } catch (e) { if (version === selectionVersion) { selectedSkill.value = null; error(e) } }
  finally { if (version === selectionVersion) agentLoading.value = false }
}
const openSkill = skill => {
  if (submitLoading.value) return
  Object.assign(skillForm, { id: skill?.id ?? null, name: skill?.name || '', remark: skill?.remark || '' }); skillVisible.value = true
}
const closeSkill = done => { if (!submitLoading.value) done() }
const closeAgent = done => { if (!submitLoading.value) done() }
const saveSkill = async () => {
  if (submitLoading.value) return
  const name = skillForm.name.trim(), remark = skillForm.remark.trim()
  if (name.length < 2 || name.length > 16 || remark.length > 100) { ElMessage.error('技能名称需为2–16个字符，备注最多100个字符'); return }
  submitLoading.value = true
  try {
    const payload = { name, ...(remark ? { remark } : {}) }
    // The backend accepts omitted remarks, but rejects empty strings.
    if (skillForm.id && !remark && skills.value.find(s => s.id === skillForm.id)?.remark) {
      ElMessage.error('备注不能为空，请填写1–100个字符'); return
    }
    check(await (skillForm.id ? updateSkill(skillForm.id, payload) : addSkill(payload)))
    if (selectedSkill.value?.id === skillForm.id) selectedSkill.value = { ...selectedSkill.value, ...payload }
    skillVisible.value = false; ElMessage.success('技能已保存'); await loadSkills()
  } catch (e) { error(e) }
  finally { submitLoading.value = false }
}
const removeSkill = async skill => {
  if (submitLoading.value) return
  const groups = skillBindings[skill.id] || []
  if (groups.length) {
    ElMessage.warning(`技能仍被以下技能组使用：${groups.map(group => group.name).join('、')}。请先在技能组中移除此技能。`)
    return
  }
  try { await ElMessageBox.confirm(`确认删除技能“${skill.name}”？若仍绑定坐席，后端会拒绝删除。`, '提示', { type: 'warning' }) }
  catch { return }
  submitLoading.value = true
  try {
    check(await deleteSkill(skill.id))
    if (selectedSkill.value?.id === skill.id) { ++selectionVersion; selectedSkill.value = null; agents.value = []; agentLoading.value = false }
    ElMessage.success('技能已删除'); await loadSkills()
  } catch (e) { error(e) }
  finally { submitLoading.value = false }
}
const openAgent = row => {
  Object.assign(agentForm, { agentId: row?.agentId ?? null, agentKey: row?.agentKey || '', agentIds: [], rankValue: row?.rankValue ?? 50 })
  agentVisible.value = true
}
const saveAgent = async () => {
  if (submitLoading.value || !selectedSkill.value) return
  if (!Number.isInteger(agentForm.rankValue) || agentForm.rankValue < 1 || agentForm.rankValue > 100) { ElMessage.error('技能等级必须为1–100的整数'); return }
  if (!agentForm.agentId && (!agentForm.agentIds.length || agentForm.agentIds.length > 500)) { ElMessage.error('请选择1–500个坐席'); return }
  const skill = selectedSkill.value
  submitLoading.value = true
  let saved = false
  try {
    check(await (agentForm.agentId
      ? updateSkillAgent(skill.id, { agentId: agentForm.agentId, rankValue: agentForm.rankValue })
      : addSkillAgent(skill.id, { agentIds: [...agentForm.agentIds], rankValue: agentForm.rankValue })))
    agentVisible.value = false; saved = true; ElMessage.success('坐席技能已保存')
  } catch (e) { error(e) }
  finally { submitLoading.value = false }
  if (saved) await selectSkill(skill)
}
const removeAgent = async row => {
  const skill = selectedSkill.value
  try { await ElMessageBox.confirm(`确认移除坐席“${row.agentKey}”的“${skill.name}”技能？`, '提示', { type: 'warning' }) }
  catch { return }
  if (submitLoading.value) return
  submitLoading.value = true
  let saved = false
  try { check(await deleteSkillAgent(skill.id, { agentIds: [row.agentId] })); saved = true; ElMessage.success('坐席技能已移除') }
  catch (e) { error(e) }
  finally { submitLoading.value = false }
  if (saved && selectedSkill.value?.id === skill.id) await selectSkill(skill)
}
onMounted(loadSkills)
</script>

<style scoped>
.skill-layout { display: flex; gap: 16px; align-items: flex-start; margin-top: 16px; }
.left-panel { width: 340px; flex-shrink: 0; }
.right-panel { flex: 1; min-width: 0; }
.skill-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 8px; border-bottom: 1px solid var(--border-color-light); }
.skill-label { display: flex; align-items: center; gap: 8px; min-width: 0; }
.skill-row.active { background: var(--el-color-primary-light-9); }
.card-header-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.binding-info { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; }
.agent-search { display: flex; gap: 8px; margin-bottom: 16px; }
.agent-search .el-input { max-width: 240px; }
.remark { color: var(--text-secondary); font-size: 13px; }
@media (max-width: 900px) { .skill-layout { flex-direction: column; } .left-panel, .right-panel { width: 100%; box-sizing: border-box; } .agent-search { flex-wrap: wrap; } }
</style>

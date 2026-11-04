<template>
  <div class="page-card">
    <div class="page-header">
      <h2>坐席管理</h2>
      <div class="header-actions">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增
        </el-button>
        <el-button @click="handleExport">
          <el-icon><Download /></el-icon>
          导出
        </el-button>
        <el-button type="success" @click="batchVisible = true">
          <el-icon><Plus /></el-icon>
          批量新增
        </el-button>
      </div>
    </div>

    <el-form :model="searchForm" inline class="search-form">
      <el-form-item label="主技能组">
        <el-select v-model="searchForm.groupId" placeholder="请选择" clearable style="width: 160px">
          <el-option v-for="g in groupOptions" :key="g.id" :label="g.name" :value="g.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="主技能组id">
        <el-input v-model="searchForm.groupId" placeholder="请输入" clearable style="width: 100px" />
      </el-form-item>
      <el-form-item label="分机号">
        <el-input v-model="searchForm.sip" placeholder="请输入" clearable style="width: 120px" />
      </el-form-item>
      <el-form-item label="坐席账号">
        <el-input v-model="searchForm.agentKey" placeholder="请输入" clearable style="width: 120px" />
      </el-form-item>
      <el-form-item label="在线">
        <el-select v-model="searchForm.online" placeholder="请选择" clearable style="width: 100px">
          <el-option label="在线" :value="1" />
          <el-option label="下线" :value="0" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">
          <el-icon><Search /></el-icon>
          搜索
        </el-button>
        <el-button @click="handleReset">
          <el-icon><Refresh /></el-icon>
          重置
        </el-button>
      </el-form-item>
    </el-form>

    <el-table :data="list" v-loading="loading" style="width: 100%">
      <el-table-column prop="agentKey" label="坐席账号" width="100" />
      <el-table-column prop="agentName" label="坐席名称" width="100" />
      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">{{ formatTime(row.cts) }}</template>
      </el-table-column>
      <el-table-column label="修改时间" width="170">
        <template #default="{ row }">{{ formatTime(row.uts) }}</template>
      </el-table-column>
      <el-table-column label="分机号" width="100">
        <template #default="{ row }">{{ row.agentCode || '-' }}</template>
      </el-table-column>
      <el-table-column prop="sipPhone" label="手机接听号码" width="140" />
      <el-table-column label="坐席类型" width="100">
        <template #default="{ row }">
          <el-tag size="small">{{ agentTypeLabel(row.agentType) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="主技能组" width="140" align="center">
        <template #default="{ row }">{{ groupLabel(row.groupId) }}</template>
      </el-table-column>
      <el-table-column label="录音" width="90" align="center">
        <template #default="{ row }">
          <el-tag size="small" :type="row.record === 1 ? 'success' : 'info'">{{ row.record === 1 ? '开启' : '关闭' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="话后时长" width="80" align="center">
        <template #default="{ row }">{{ row.afterInterval ?? '-' }}s</template>
      </el-table-column>
      <el-table-column label="外显号码" width="120" show-overflow-tooltip>
        <template #default="{ row }">{{ row.display || '-' }}</template>
      </el-table-column>
      <el-table-column label="振铃时长" width="80" align="center">
        <template #default="{ row }">{{ row.ringTime || '-' }}s</template>
      </el-table-column>
      <el-table-column label="状态" width="80" align="center">
        <template #default="{ row }">
          <el-tag size="small" :type="row.status === 1 ? 'success' : 'danger'">
            {{ row.status === 1 ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="在线" width="80" align="center" fixed="right">
        <template #default="{ row }">
          <el-tag size="small" :type="row.state === 1 ? 'success' : 'info'">
            {{ row.state === 1 ? '在线' : '下线' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="380" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
          <el-button type="success" size="small" @click="handleDetail(row)">详情</el-button>
          <el-button type="primary" size="small" :icon="Connection" @click="handleGroups(row)">技能组</el-button>
          <el-button type="warning" size="small" @click="handleOffline(row)">IsOffline</el-button>
          <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination">
      <el-pagination
        v-model:current-page="pagination.currentPage"
        v-model:page-size="pagination.pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑坐席' : '新增坐席'" width="900px"
      :close-on-click-modal="!submitLoading" :close-on-press-escape="!submitLoading" :show-close="!submitLoading" @closed="resetForm">
      <div v-loading="editLoading">
        <el-form ref="formRef" :model="form" :rules="rules" label-width="110px" :disabled="editLoading || submitLoading">
          <h3 class="editor-section-title">基本信息</h3>
          <el-descriptions v-if="isEdit" :column="3" border size="small" class="editor-metadata">
            <el-descriptions-item label="坐席账号">{{ form.agentKey }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ formatTime(form.cts) }}</el-descriptions-item>
            <el-descriptions-item label="修改时间">{{ formatTime(form.uts) }}</el-descriptions-item>
            <el-descriptions-item label="在线状态">{{ form.state === 1 ? '在线' : '下线' }}</el-descriptions-item>
          </el-descriptions>
          <el-row :gutter="20">
            <el-col :span="12"><el-form-item label="坐席工号" prop="agentId">
              <el-input v-model="form.agentId" :disabled="isEdit" placeholder="4-16个字符" />
            </el-form-item></el-col>
            <el-col :span="12"><el-form-item label="坐席名称" prop="agentName">
              <el-input v-model="form.agentName" placeholder="坐席名称" />
            </el-form-item></el-col>
            <el-col :span="12"><el-form-item label="密码" prop="passwd">
              <el-input v-model="form.passwd" :placeholder="isEdit ? '留空保留原密码' : '请输入密码'" show-password autocomplete="new-password" />
            </el-form-item></el-col>
            <el-col :span="12"><el-form-item label="手机接听号码">
              <el-input v-model="form.sipPhone" placeholder="手机接听模式使用的手机号" />
              <div class="group-hint">选择“手机”接听时，系统将呼叫此号码。</div>
            </el-form-item></el-col>
            <el-col :span="12"><el-form-item label="分机号">
              <el-input v-model="form.agentCode" placeholder="坐席分机号" maxlength="20" />
            </el-form-item></el-col>
            <el-col :span="12"><el-form-item label="坐席类型">
              <el-select v-model="form.agentType" style="width: 100%">
                <el-option label="普通坐席" :value="1" /><el-option label="班长坐席" :value="2" />
              </el-select>
            </el-form-item></el-col>
            <el-col :span="12"><el-form-item label="外显号码">
              <el-select v-model="form.display" clearable filterable placeholder="留空时使用技能组号码池" style="width: 100%">
                <el-option
                  v-for="phone in displayPhoneOptions"
                  :key="phone.id"
                  :label="phone.phone"
                  :value="phone.phone"
                />
                <el-option
                  v-if="form.display && !displayPhoneOptions.some(phone => phone.phone === form.display)"
                  :label="`${form.display}（当前配置，不在启用的被叫号码中）`"
                  :value="form.display"
                />
              </el-select>
            </el-form-item></el-col>
            <el-col :span="12"><el-form-item label="振铃时长(秒)" prop="ringTime">
              <el-input-number v-model="form.ringTime" :min="1" :max="600" :precision="0" style="width: 100%" />
            </el-form-item></el-col>
            <el-col :span="12"><el-form-item label="话后时长(秒)" prop="afterInterval">
              <el-input-number v-model="form.afterInterval" :min="0" :precision="0" style="width: 100%" />
            </el-form-item></el-col>
            <el-col :span="12"><el-form-item label="录音">
              <el-switch v-model="form.record" :active-value="1" :inactive-value="0" active-text="开启" inactive-text="关闭" />
            </el-form-item></el-col>
            <el-col :span="12"><el-form-item label="状态">
              <el-switch v-model="form.status" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="禁用" />
            </el-form-item></el-col>
          </el-row>

          <h3 class="editor-section-title">技能组</h3>
          <el-form-item label="所属技能组">
            <el-select v-model="form.groups.groupIds" multiple filterable placeholder="选择所属技能组" style="width: 100%" @change="handleEditGroupSelection">
              <el-option v-for="g in groupOptions" :key="g.id" :label="g.name" :value="g.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="主技能组">
            <el-select v-model="form.groups.groupId" :disabled="!form.groups.groupIds.length" placeholder="从所属技能组中选择" style="width: 100%">
              <el-option v-for="id in form.groups.groupIds" :key="id" :label="groupLabel(id)" :value="id" />
            </el-select>
          </el-form-item>
          <el-table :data="editGroupRows" size="small" class="editor-group-table">
            <el-table-column prop="id" label="技能组ID" width="100" />
            <el-table-column prop="name" label="技能组名称" />
            <el-table-column prop="levelValue" label="技能组等级" width="120" />
            <el-table-column label="主技能组" width="110">
              <template #default="{ row }"><el-tag v-if="row.isPrimary === 1" size="small" type="success">主技能组</el-tag><span v-else>—</span></template>
            </el-table-column>
          </el-table>

          <div class="editor-section-header">
            <h3 class="editor-section-title">坐席技能</h3>
            <el-button type="primary" plain size="small" :disabled="editLoading || submitLoading || form.skillAgents.length >= 20" @click="addAgentSkill">添加技能</el-button>
          </div>
          <el-table :data="form.skillAgents" size="small" empty-text="暂无技能，点击“添加技能”进行配置">
            <el-table-column label="技能名称" min-width="220">
              <template #default="{ row, $index }">
                <el-form-item :prop="`skillAgents.${$index}.skillId`" :rules="{ required: true, message: '请选择技能', trigger: 'change' }" class="skill-cell-field">
                  <el-select v-model="row.skillId" filterable placeholder="请选择技能" style="width: 100%">
                    <el-option v-for="skill in skillOptions" :key="skill.id" :label="skill.name" :value="skill.id"
                      :disabled="form.skillAgents.some(other => other !== row && String(other.skillId) === String(skill.id))" />
                  </el-select>
                </el-form-item>
              </template>
            </el-table-column>
            <el-table-column label="技能等级（1-100）" min-width="170">
              <template #default="{ row, $index }">
                <el-form-item :prop="`skillAgents.${$index}.rankValue`" :rules="{ required: true, type: 'number', min: 1, max: 100, message: '填写1-100之间的等级', trigger: 'change' }" class="skill-cell-field">
                  <el-input-number v-model="row.rankValue" :min="1" :max="100" :precision="0" style="width: 100%" />
                </el-form-item>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="90" align="center">
              <template #default="{ $index }"><el-button link type="danger" @click="form.skillAgents.splice($index, 1)">移除</el-button></template>
            </el-table-column>
          </el-table>
          <p class="group-hint">技能组和技能变更后，坐席需重新登录生效。</p>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false" :disabled="submitLoading">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitLoading" :disabled="editLoading || !editLoaded">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailVisible" title="坐席详情" width="900px" @close="detailVisible = false">
      <div v-loading="detailLoading" v-if="detail">
        <h3 class="editor-section-title">基本信息</h3>
        <el-descriptions :column="3" border size="small">
          <el-descriptions-item label="坐席账号">{{ detail.agentKey }}</el-descriptions-item>
          <el-descriptions-item label="坐席工号">{{ detail.agentId }}</el-descriptions-item>
          <el-descriptions-item label="坐席名称">{{ detail.agentName }}</el-descriptions-item>
          <el-descriptions-item label="分机号">{{ detail.agentCode || '—' }}</el-descriptions-item>
          <el-descriptions-item label="手机接听号码">{{ detail.sipPhone || '—' }}</el-descriptions-item>
          <el-descriptions-item label="坐席类型">{{ agentTypeLabel(detail.agentType) }}</el-descriptions-item>
          <el-descriptions-item label="主技能组">{{ groupLabel(detail.groupId) }}</el-descriptions-item>
          <el-descriptions-item label="话后时长">{{ detail.afterInterval ?? '—' }} 秒</el-descriptions-item>
          <el-descriptions-item label="振铃时长">{{ detail.ringTime ?? '—' }} 秒</el-descriptions-item>
          <el-descriptions-item label="外显号码">{{ detail.display || '—' }}</el-descriptions-item>
          <el-descriptions-item label="录音">{{ detail.record === 1 ? '开启' : '关闭' }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ detail.status === 1 ? '启用' : '禁用' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatTime(detail.cts) }}</el-descriptions-item>
          <el-descriptions-item label="修改时间">{{ formatTime(detail.uts) }}</el-descriptions-item>
          <el-descriptions-item label="在线状态">{{ detail.state === 1 ? '在线' : '下线' }}</el-descriptions-item>
        </el-descriptions>
        <h3 class="editor-section-title">技能组</h3>
        <el-table :data="groupTableData" size="small" max-height="250">
          <el-table-column prop="id" label="技能组ID" width="100" />
          <el-table-column prop="name" label="技能组名称" />
          <el-table-column prop="levelValue" label="技能组等级" width="120" />
          <el-table-column label="主技能组" width="110">
            <template #default="{ row }"><el-tag v-if="row.isPrimary === 1" size="small" type="success">主技能组</el-tag><span v-else>—</span></template>
          </el-table-column>
        </el-table>
        <h3 class="editor-section-title">坐席技能</h3>
        <el-table :data="detail.skillAgents || []" size="small" max-height="250">
          <el-table-column prop="skillId" label="技能ID" width="100" />
          <el-table-column label="技能名称"><template #default="{ row }">{{ skillLabel(row.skillId) }}</template></el-table-column>
          <el-table-column prop="rankValue" label="技能等级" width="170" />
        </el-table>
      </div>
      <el-empty v-else-if="!detailLoading" description="暂无详情数据" />
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button v-if="detail" type="primary" @click="editFromDetail">编辑坐席</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="batchVisible" title="批量新增" width="500px" @close="resetBatch">
      <p class="group-hint">创建后，请在列表的“技能组”中设置所属技能组和主技能组。</p>
      <el-form ref="batchFormRef" :model="batchForm" :rules="batchRules" label-width="100px">
        <el-form-item label="新增坐席数" prop="count">
          <el-input v-model.number="batchForm.count" placeholder="1-1000" />
        </el-form-item>
        <el-form-item label="起始编号" prop="start">
          <el-input v-model.number="batchForm.start" placeholder="100-1000000" />
        </el-form-item>
        <el-form-item label="坐席前缀" prop="prefix">
          <el-input v-model="batchForm.prefix" placeholder="最多4位" maxlength="4" />
        </el-form-item>
        <el-form-item label="密码" prop="passwd">
          <el-input v-model="batchForm.passwd" placeholder="8-32位" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchVisible = false">取消</el-button>
        <el-button type="primary" @click="handleBatchSubmit" :loading="batchLoading">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="groupsVisible" title="坐席技能组" width="520px" :close-on-click-modal="!groupsSaving" :close-on-press-escape="!groupsSaving" :show-close="!groupsSaving" @closed="resetGroups">
      <div v-loading="groupsLoading">
        <p>坐席：{{ groupsAgent?.agentKey }}</p>
        <el-form label-width="100px">
          <el-form-item label="所属技能组">
            <el-select v-model="groupsForm.groupIds" multiple filterable style="width: 100%" :disabled="groupsLoading || groupsSaving" @change="handleGroupSelection">
              <el-option v-for="g in groupOptions" :key="g.id" :label="g.name" :value="g.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="主技能组">
            <el-select v-model="groupsForm.groupId" style="width: 100%" placeholder="从所属技能组中选择" :disabled="groupsLoading || groupsSaving || !groupsForm.groupIds.length">
              <el-option v-for="id in groupsForm.groupIds" :key="id" :label="groupLabel(id)" :value="id" />
            </el-select>
          </el-form-item>
        </el-form>
        <p class="group-hint">新增坐席后可在此加入多个技能组，并指定一个主技能组用于外呼。变更后需重新登录坐席生效。</p>
      </div>
      <template #footer>
        <el-button @click="groupsVisible = false" :disabled="groupsSaving">取消</el-button>
        <el-button type="primary" @click="handleSaveGroups" :loading="groupsSaving" :disabled="groupsLoading || !groupsLoaded">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { Connection } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getAgentConfigList, getAgentConfigDetail, addAgentConfig, updateAgentConfig, deleteAgentConfig, batchAddAgents, updateAgentGroups, getPhoneList } from '@/api/config'
import { getGroupConfigList, getSkillList } from '@/api/config'
import { createAgentForm, buildAgentPayload } from '@/utils/agentEditor'
import { buildAgentGroupsPayload, getAgentGroupRows } from '@/utils/agentGroups'

const loading = ref(false)
const submitLoading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref()
const list = ref([])
const groupOptions = ref([])
const searchForm = reactive({ groupId: '', sip: '', agentKey: '', agentName: '', online: '' })
const pagination = reactive({ currentPage: 1, pageSize: 10, total: 0 })
const form = reactive(createAgentForm())
const editLoading = ref(false)
const editLoaded = ref(false)
const skillOptions = ref([])
const displayPhoneOptions = ref([])
let editRequest = 0
const rules = {
  agentId: [{ required: true, message: '请输入坐席工号', trigger: 'blur' }, { min: 4, max: 16, message: '工号必须在4-16个字符之间', trigger: 'blur' }],
  agentName: [{ required: true, message: '请输入坐席名称', trigger: 'blur' }],
  ringTime: [{ required: true, type: 'number', min: 1, max: 600, message: '振铃时长必须在1-600秒之间', trigger: 'change' }],
  afterInterval: [{ required: true, type: 'number', min: 0, message: '话后时长不能小于0', trigger: 'change' }]
}
const agentTypeLabel = (type) => ({ 1: '普通坐席', 2: '班长坐席' }[type] || '—')
const skillLabel = (id) => skillOptions.value.find(skill => String(skill.id) === String(id))?.name || `技能 ${id}`
const editGroupRows = computed(() => getAgentGroupRows(form.groups, groupOptions.value))
const addAgentSkill = () => form.skillAgents.push({ skillId: null, rankValue: 1 })
const handleEditGroupSelection = () => {
  if (!form.groups.groupIds.some(id => String(id) === String(form.groups.groupId))) form.groups.groupId = null
}

const formatTime = (ts) => {
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleString('zh-CN', { hour12: false })
}

const groupLabel = (id) => id == null ? '-' : groupOptions.value.find(group => String(group.id) === String(id))?.name || String(id)

const resetForm = () => {
  editRequest++
  editLoaded.value = false
  Object.assign(form, createAgentForm())
  formRef.value?.clearValidate()
}

const loadSkills = async () => {
  const skills = []
  let pageNum = 1
  let total = 0
  do {
    const res = await getSkillList({ pageNum, pageSize: 100, query: '{}' })
    if (res.code !== 0) throw new Error(res.message || '技能列表加载失败')
    const page = res.data?.list || []
    skills.push(...page)
    total = res.data?.total || skills.length
    if (!page.length) break
    pageNum++
  } while (skills.length < total)
  skillOptions.value = skills
}

const loadGroups = async () => {
  const groups = []
  let pageNum = 1
  let total = 0
  do {
    const res = await getGroupConfigList({ pageNum, pageSize: 100, query: '{}' })
    if (res.code !== 0) throw new Error(res.message || '技能组加载失败')
    const page = res.data?.list || []
    groups.push(...page)
    total = res.data?.total || groups.length
    if (!page.length) break
    pageNum++
  } while (groups.length < total)
  groupOptions.value = groups
}

const loadDisplayPhones = async () => {
  try {
    const phones = []
    let pageNum = 1
    let total = 0
    do {
      const res = await getPhoneList({ pageNum, pageSize: 100, query: JSON.stringify({ type: 3 }) })
      if (res.code !== 0) throw new Error(res.message || '被叫号码加载失败')
      const page = res.data?.list || []
      phones.push(...page)
      total = res.data?.total || phones.length
      if (!page.length) break
      pageNum++
    } while (phones.length < total)
    displayPhoneOptions.value = phones.filter(phone => Number(phone.type) === 3 && Number(phone.status) === 2)
  } catch (error) {
    displayPhoneOptions.value = []
    ElMessage.warning(error.message || '被叫号码加载失败，暂时无法选择新号码')
  }
}

const loadData = async () => {
  loading.value = true
  try {
    const query = {}
    if (searchForm.groupId) query.groupId = searchForm.groupId
    if (searchForm.sip) query.sip = searchForm.sip
    if (searchForm.agentKey) query.agentKey = searchForm.agentKey
    if (searchForm.agentName) query.agentName = searchForm.agentName
    if (searchForm.online !== '') query.online = searchForm.online
    const params = { pageNum: pagination.currentPage, pageSize: pagination.pageSize, query: JSON.stringify(query) }
    const res = await getAgentConfigList(params)
    if (res.code === 0) {
      list.value = res.data?.list || []
      pagination.total = res.data?.total || 0
    }
  } catch { /* empty */ }
  finally { loading.value = false }
}

const batchVisible = ref(false)
const batchLoading = ref(false)
const batchFormRef = ref()
const batchForm = reactive({ count: null, start: null, prefix: '', passwd: '' })
const batchRules = {
  count: [{ required: true, message: '请输入坐席数量', trigger: 'blur' }],
  start: [{ required: true, message: '请输入起始编号', trigger: 'blur' }],
  passwd: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const resetBatch = () => {
  batchFormRef.value?.resetFields()
  Object.assign(batchForm, { count: null, start: null, prefix: '', passwd: '' })
}

const handleBatchSubmit = async () => {
  if (!batchFormRef.value) return
  try { await batchFormRef.value.validate() } catch { return }
  batchLoading.value = true
  try {
    await batchAddAgents({ ...batchForm })
    ElMessage.success('批量新增成功')
    batchVisible.value = false
    loadData()
  } catch { ElMessage.error('操作失败') }
  finally { batchLoading.value = false }
}

const handleExport = () => {
  const params = new URLSearchParams()
  params.set('pageNum', '1')
  params.set('pageSize', '999999')
  params.set('query', '{}')
  window.open(`/voxai-admin/config/agent/export?${params.toString()}`, '_blank')
}

const handleSearch = () => { pagination.currentPage = 1; loadData() }
const handleReset = () => { searchForm.groupId = ''; searchForm.sip = ''; searchForm.agentKey = ''; searchForm.agentName = ''; searchForm.online = ''; pagination.currentPage = 1; loadData() }
const handleSizeChange = () => loadData()
const handleCurrentChange = () => loadData()

const openEditor = async (row) => {
  resetForm()
  const requestId = ++editRequest
  isEdit.value = !!row
  dialogVisible.value = true
  editLoading.value = true
  try {
    const [res] = await Promise.all([
      row ? getAgentConfigDetail(row.id) : Promise.resolve({ code: 0, data: {} }),
      loadGroups(), loadSkills(), loadDisplayPhones()
    ])
    if (requestId !== editRequest) return
    if (res.code !== 0 || !res.data) throw new Error(res.message || '坐席详情加载失败')
    Object.assign(form, createAgentForm({ ...res.data, id: row?.id }))
    editLoaded.value = true
  } catch (error) {
    if (requestId === editRequest) ElMessage.error(error.message || '坐席详情加载失败')
  } finally {
    if (requestId === editRequest) editLoading.value = false
  }
}
const handleAdd = () => openEditor()
const handleEdit = (row) => openEditor(row)
const editFromDetail = () => {
  const row = detail.value
  detailVisible.value = false
  openEditor(row)
}

const handleSubmit = async () => {
  if (!formRef.value || !editLoaded.value || editLoading.value || submitLoading.value) return
  try { await formRef.value.validate() } catch { return }
  let payload
  try { payload = buildAgentPayload(form) }
  catch (error) { ElMessage.error(error.message); return }
  submitLoading.value = true
  try {
    const res = isEdit.value ? await updateAgentConfig(form.id, payload) : await addAgentConfig(payload)
    if (res.code !== 0) throw new Error(res.message || '保存失败')
    ElMessage.success(isEdit.value ? '修改成功' : '新增成功')
    dialogVisible.value = false
    await loadData()
  } catch (error) { ElMessage.error(error.message || '操作失败') }
  finally { submitLoading.value = false }
}

const detailVisible = ref(false)
const detail = ref(null)
const detailLoading = ref(false)

const groupTableData = computed(() => getAgentGroupRows(detail.value, groupOptions.value))

const groupsVisible = ref(false)
const groupsLoading = ref(false)
const groupsSaving = ref(false)
const groupsLoaded = ref(false)
const groupsAgent = ref(null)
const groupsForm = reactive({ groupIds: [], groupId: null })
let groupsRequest = 0

const resetGroups = () => {
  groupsRequest++
  groupsLoaded.value = false
}

const handleGroups = async (row) => {
  const requestId = ++groupsRequest
  groupsAgent.value = row
  groupsVisible.value = true
  groupsLoaded.value = false
  groupsLoading.value = true
  Object.assign(groupsForm, { groupIds: [], groupId: null })
  try {
    const [res] = await Promise.all([getAgentConfigDetail(row.id), loadGroups()])
    if (requestId !== groupsRequest) return
    if (res.code !== 0) throw new Error(res.message || '坐席技能组加载失败')
    Object.assign(groupsForm, { groupIds: [...(res.data.groupIds || [])], groupId: res.data.groupId ?? null })
    groupsLoaded.value = true
  } catch (error) {
    if (requestId === groupsRequest) ElMessage.error(error.message || '坐席技能组加载失败')
  } finally {
    if (requestId === groupsRequest) groupsLoading.value = false
  }
}

const handleGroupSelection = () => {
  if (!groupsForm.groupIds.some(id => String(id) === String(groupsForm.groupId))) groupsForm.groupId = null
}

const handleSaveGroups = async () => {
  if (!groupsLoaded.value || groupsLoading.value || groupsSaving.value) return
  let payload
  try { payload = buildAgentGroupsPayload(groupsForm) }
  catch (error) { ElMessage.error(error.message); return }
  groupsSaving.value = true
  try {
    const res = await updateAgentGroups(groupsAgent.value.id, payload)
    if (res.code !== 0) throw new Error(res.message || '技能组保存失败')
    ElMessage.success('技能组保存成功')
    groupsVisible.value = false
    await loadData()
  } catch (error) { ElMessage.error(error.message || '技能组保存失败') }
  finally { groupsSaving.value = false }
}

const handleDetail = async (row) => {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    const [res] = await Promise.all([getAgentConfigDetail(row.id), loadGroups(), loadSkills()])
    if (res.code !== 0 || !res.data) throw new Error(res.message || '坐席详情加载失败')
    detail.value = res.data
  } catch (error) { ElMessage.error(error.message || '坐席详情加载失败') }
  finally { detailLoading.value = false }
}

const handleOffline = async (row) => {
  try {
    await ElMessageBox.confirm(`确认将坐席 "${row.agentKey}" 强制下线吗？`, '提示', { type: 'warning' })
    // TODO: call offline API
    ElMessage.success(`${row.agentKey} 已下线`)
  } catch { /* cancelled */ }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确认删除坐席 "${row.agentKey}" 吗？`, '提示', { type: 'warning' })
    await deleteAgentConfig(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch { /* cancelled */ }
}

onMounted(() => { loadData(); loadGroups().catch(error => ElMessage.error(error.message)) })
</script>

<style scoped>
.header-actions { display: flex; gap: 8px; }
.pagination { margin-top: 20px; display: flex; justify-content: center; }
.editor-section-title { margin: 24px 0 16px; font-size: 16px; font-weight: 600; color: var(--text-primary); }
.editor-section-title:first-child { margin-top: 0; }
.editor-section-header { display: flex; align-items: center; justify-content: space-between; margin-top: 24px; margin-bottom: 16px; }
.editor-section-header .editor-section-title { margin: 0; }
.editor-metadata { margin-bottom: 20px; }
.editor-group-table { margin-bottom: 24px; }
.skill-cell-field { margin: 12px 0 20px; }
.group-hint { color: var(--text-secondary); line-height: 1.6; }
</style>

<template>
  <div class="page-card">
    <div class="page-header">
      <h2>SIP 分机</h2>
      <div>
        <el-button @click="batchVisible = true">批量创建</el-button>
        <el-button type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>新增</el-button>
      </div>
    </div>

    <el-form :model="searchForm" inline class="search-form">
      <el-form-item label="sip号">
        <el-input v-model="searchForm.sip" placeholder="请输入" clearable />
      </el-form-item>
      <el-form-item label="企业ID">
        <el-input v-model="searchForm.companyId" placeholder="请输入" clearable />
      </el-form-item>
      <el-form-item label="坐席ID">
        <el-input v-model="searchForm.agentId" placeholder="请输入坐席ID" clearable />
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

    <el-alert v-if="loadError" :title="loadError" type="error" :closable="false" show-icon />
    <el-table :data="list" row-key="id" v-loading="loading" style="width: 100%">
      <el-table-column label="sip号" min-width="110">
        <template #default="{ row }">{{ row.sip }}</template>
      </el-table-column>
      <el-table-column label="SIP 密码" min-width="160">
        <template #default="{ row }"><SecretText :key="`${row.id}-${dataVersion}`" :value="row.sipPwd" /></template>
      </el-table-column>
      <el-table-column prop="companyId" label="企业ID" width="80" />
      <el-table-column label="配置状态" min-width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
            {{ row.status === 1 ? '有效' : '无效' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="坐席账号" min-width="110">
        <template #default="{ row }">{{ row.agentKey || (row.agent && row.agent.agentKey) || '' }}</template>
      </el-table-column>
      <el-table-column label="创建时间" min-width="160">
        <template #default="{ row }">{{ formatTime(row.cts) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
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

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑 SIP 分机' : '新增 SIP 分机'" width="min(520px, 94vw)"
      :show-close="!submitLoading" :close-on-click-modal="false" :close-on-press-escape="!submitLoading" @closed="resetForm">
      <p class="form-help">分机归属当前登录账号绑定的企业，创建后可在坐席管理中绑定使用。</p>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" :disabled="submitLoading">
        <el-form-item label="sip号" prop="sip">
          <el-input v-model="form.sip" placeholder="如：950001" maxlength="10" />
        </el-form-item>
        <el-form-item label="sip密码" prop="sipPwd">
          <el-input v-model="form.sipPwd" type="password" placeholder="8–16 个字符" show-password autocomplete="new-password" maxlength="16" />
        </el-form-item>
        <el-form-item v-if="isEdit" label="企业ID">
          <span>{{ form.companyId }}</span>
        </el-form-item>
        <el-form-item label="坐席ID" prop="agentId">
          <el-input v-model.number="form.agentId" placeholder="绑定坐席ID" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="submitLoading" @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitLoading">确定</el-button>
      </template>
    </el-dialog>
    <SipBatchDialog v-model="batchVisible" @created="loadData" />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getSipList, addSip, updateSip, deleteSip } from '@/api/config'
import SecretText from '@/components/SecretText.vue'
import SipBatchDialog from '@/components/SipBatchDialog.vue'
import { requireApiSuccess, sipNumberError, sipPasswordError } from '@/utils/sipProvisioning'

const loading = ref(false)
const submitLoading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref()
const list = ref([])
const batchVisible = ref(false)
const dataVersion = ref(0)
const loadError = ref('')
const searchForm = reactive({ sip: '', companyId: '', agentId: '' })
const pagination = reactive({ currentPage: 1, pageSize: 10, total: 0 })
const form = reactive({ id: null, sip: '', sipPwd: '', companyId: null, agentId: null })

const validator = check => (_rule, value, callback) => {
  const error = check(value)
  callback(error ? new Error(error) : undefined)
}

const rules = {
  sip: [{ validator: validator(sipNumberError), trigger: 'blur' }],
  sipPwd: [{ validator: validator(sipPasswordError), trigger: 'blur' }],
  agentId: [{ validator: validator(value => value == null || value === '' || (Number.isSafeInteger(value) && value > 0) ? '' : '坐席ID须为正整数'), trigger: 'blur' }]
}

const formatTime = (ts) => {
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleString('zh-CN', { hour12: false })
}

const resetForm = () => {
  formRef.value?.resetFields()
  Object.assign(form, { id: null, sip: '', sipPwd: '', companyId: null, agentId: null })
}

const loadData = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const query = {}
    if (searchForm.sip) query.sip = searchForm.sip
    if (searchForm.companyId) query.companyId = searchForm.companyId
    if (searchForm.agentId) query.agentId = searchForm.agentId
    const params = { pageNum: pagination.currentPage, pageSize: pagination.pageSize, query: JSON.stringify(query) }
    const res = await getSipList(params)
    const data = requireApiSuccess(res)
    list.value = data?.list || []
    pagination.total = data?.total || 0
    dataVersion.value++
  } catch (error) { loadError.value = error.message || '加载分机列表失败' }
  finally { loading.value = false }
}

const handleSearch = () => { pagination.currentPage = 1; loadData() }
const handleReset = () => { searchForm.sip = ''; searchForm.companyId = ''; searchForm.agentId = ''; pagination.currentPage = 1; loadData() }

const handleAdd = () => { isEdit.value = false; resetForm(); dialogVisible.value = true }

const handleEdit = (row) => {
  isEdit.value = true
  Object.assign(form, {
    id: row.id, sip: String(row.sip), sipPwd: row.sipPwd || '',
    companyId: row.companyId ?? null, agentId: row.agentId ?? null
  })
  dialogVisible.value = true
}

const handleSubmit = async () => {
  if (!formRef.value || submitLoading.value) return
  submitLoading.value = true
  try {
    if (!await formRef.value.validate().catch(() => false)) return
    const payload = { sip: String(form.sip), sipPwd: form.sipPwd, agentId: form.agentId || null }
    requireApiSuccess(isEdit.value ? await updateSip(form.id, payload) : await addSip(payload))
    ElMessage.success(isEdit.value ? '修改成功' : '新增成功')
    dialogVisible.value = false
    loadData()
  } catch (error) { ElMessage.error(error.message || '操作失败') }
  finally { submitLoading.value = false }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确认删除sip号 "${row.sip}" 吗？`, '提示', { type: 'warning' })
    requireApiSuccess(await deleteSip(row.id))
    ElMessage.success('删除成功')
    loadData()
  } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || '删除失败') }
}

const handleSizeChange = () => { pagination.currentPage = 1; loadData() }
const handleCurrentChange = () => loadData()

onMounted(loadData)
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; gap: 12px; flex-wrap: wrap; }
.page-header h2 { font-size: 20px; font-weight: 600; color: #303133; margin: 0; }
.search-form { margin-bottom: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px; }
.pagination { margin-top: 20px; display: flex; justify-content: center; }
.form-help { color: var(--text-secondary); line-height: 1.6; margin: 0 0 20px; }
</style>

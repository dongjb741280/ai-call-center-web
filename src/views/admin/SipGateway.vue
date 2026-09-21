<template>
  <div class="page-card">
    <div class="page-header">
      <h2>SIP 网关</h2>
      <el-button type="primary" @click="handleAdd">
        <el-icon><Plus /></el-icon>
        新增
      </el-button>
    </div>

    <el-form :model="searchForm" inline class="search-form">
      <el-form-item label="网关账号">
        <el-input v-model="searchForm.username" placeholder="请输入" clearable />
      </el-form-item>
      <el-form-item label="企业编码">
        <el-input v-model="searchForm.companyCode" placeholder="请输入企业编码" clearable />
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
      <el-table-column prop="username" label="网关账号" min-width="120" />
      <el-table-column label="网关密码" min-width="160">
        <template #default="{ row }"><SecretText :key="`${row.id}-${dataVersion}`" :value="row.passwd" /></template>
      </el-table-column>
      <el-table-column prop="companyId" label="企业ID" min-width="90" />
      <el-table-column prop="companyCode" label="企业编码" min-width="90" />
      <el-table-column prop="companyName" label="企业名称" min-width="180" show-overflow-tooltip />
      <el-table-column prop="registerAddr" label="注册地址" min-width="160" show-overflow-tooltip />
      <el-table-column prop="external" label="网关外网" min-width="130" show-overflow-tooltip>
        <template #default="{ row }">{{ row.external || '-' }}</template>
      </el-table-column>
      <el-table-column prop="internal" label="网关内网" min-width="130" show-overflow-tooltip>
        <template #default="{ row }">{{ row.internal || '-' }}</template>
      </el-table-column>
      <el-table-column label="注册时间" min-width="90" align="center">
        <template #default="{ row }">{{ row.registerTime ? formatTime(row.registerTime) : '-' }}</template>
      </el-table-column>
      <el-table-column prop="expire" label="注册周期" min-width="80" align="center">
        <template #default="{ row }">{{ row.expire ?? 0 }}</template>
      </el-table-column>
      <el-table-column label="状态" min-width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === 2 ? 'success' : 'danger'" size="small">
            {{ row.status === 2 ? '在线' : '下线' }}
          </el-tag>
        </template>
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

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑 SIP 网关' : '新增 SIP 网关'" width="min(560px, 94vw)"
      :show-close="!submitLoading" :close-on-click-modal="false" :close-on-press-escape="!submitLoading" @closed="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" :disabled="submitLoading">
        <el-form-item label="企业ID" prop="companyId">
          <el-input v-model.number="form.companyId" placeholder="企业ID，0 表示不绑定" />
          <span class="form-help">企业编码和名称由所绑定的企业自动确定。</span>
        </el-form-item>
        <el-form-item label="网关账号" prop="username">
          <el-input v-model="form.username" placeholder="2-16个字符" maxlength="16" />
        </el-form-item>
        <el-form-item label="网关密码" prop="passwd">
          <el-input v-model="form.passwd" type="password" placeholder="2-16个字符" maxlength="16" show-password autocomplete="new-password" />
        </el-form-item>
        <el-form-item label="注册主机" prop="host">
          <el-input v-model="form.host" placeholder="IP 或域名，如 sip.example.com" />
        </el-form-item>
        <el-form-item label="注册端口" prop="port">
          <el-input-number v-model="form.port" :min="1" :max="65535" :precision="0" placeholder="可选" />
        </el-form-item>
        <el-form-item label="注册地址">
          <span class="address-preview">{{ addressPreview || '填写有效主机和端口后显示' }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="submitLoading" @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitLoading">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getSipGatewayList, saveSipGateway, deleteSipGateway } from '@/api/admin'
import SecretText from '@/components/SecretText.vue'
import { requireApiSuccess } from '@/utils/sipProvisioning'
import { parseGatewayAddress, formatGatewayAddress, gatewayHostError, buildSipGatewayPayload } from '@/utils/sipGateway'

const loading = ref(false)
const submitLoading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref()
const list = ref([])
const loadError = ref('')
const dataVersion = ref(0)
const searchForm = reactive({ username: '', companyCode: '' })
const pagination = reactive({ currentPage: 1, pageSize: 10, total: 0 })
const form = reactive({ id: null, companyId: null, username: '', passwd: '', host: '', port: 5060 })
const addressPreview = computed(() => {
  try { return formatGatewayAddress(form.host, form.port) } catch { return '' }
})

const rules = {
  companyId: [{ validator: (_rule, value, callback) => callback(Number.isSafeInteger(value) && value >= 0 ? undefined : new Error('企业ID须为非负整数')), trigger: 'blur' }],
  username: [{ required: true, min: 2, max: 16, message: '网关账号须为 2–16 个字符', trigger: 'blur' }],
  passwd: [{ required: true, min: 2, max: 16, message: '网关密码须为 2–16 个字符', trigger: 'blur' }],
  host: [{ validator: (_rule, value, callback) => {
    const error = gatewayHostError(value)
    callback(error ? new Error(error) : undefined)
  }, trigger: 'blur' }],
  port: [{ type: 'integer', min: 1, max: 65535, message: '端口范围为 1–65535', trigger: 'blur' }]
}

const formatTime = (ts) => {
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleString('zh-CN', { hour12: false })
}

const resetForm = () => {
  formRef.value?.resetFields()
  Object.assign(form, { id: null, companyId: null, username: '', passwd: '', host: '', port: 5060 })
}

const loadData = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const query = {}
    if (searchForm.username) query.username = searchForm.username
    if (searchForm.companyCode) query.companyCode = searchForm.companyCode
    const params = { pageNum: pagination.currentPage, pageSize: pagination.pageSize, query: JSON.stringify(query) }
    const res = await getSipGatewayList(params)
    const data = requireApiSuccess(res)
    list.value = data?.list || []
    pagination.total = data?.total || 0
    dataVersion.value++
  } catch (error) { loadError.value = error.message || '加载网关列表失败' }
  finally { loading.value = false }
}

const handleSearch = () => { pagination.currentPage = 1; loadData() }
const handleReset = () => { searchForm.username = ''; searchForm.companyCode = ''; pagination.currentPage = 1; loadData() }
const handleSizeChange = () => { pagination.currentPage = 1; loadData() }
const handleCurrentChange = () => loadData()

const handleAdd = () => { isEdit.value = false; resetForm(); dialogVisible.value = true }

const handleEdit = (row) => {
  isEdit.value = true
  Object.assign(form, {
    id: row.id, companyId: row.companyId ?? null, username: row.username || '',
    passwd: row.passwd || '', ...parseGatewayAddress(row.registerAddr || '')
  })
  dialogVisible.value = true
}

const handleSubmit = async () => {
  if (!formRef.value || submitLoading.value) return
  submitLoading.value = true
  try {
    if (!await formRef.value.validate().catch(() => false)) return
    requireApiSuccess(await saveSipGateway(buildSipGatewayPayload(form)))
    ElMessage.success(isEdit.value ? '修改成功' : '新增成功')
    dialogVisible.value = false
    loadData()
  } catch (error) { ElMessage.error(error.message || '操作失败') }
  finally { submitLoading.value = false }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确认删除 "${row.username}" 吗？`, '提示', { type: 'warning' })
    requireApiSuccess(await deleteSipGateway([row.id]))
    ElMessage.success('删除成功')
    loadData()
  } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(error.message || '删除失败') }
}

onMounted(loadData)
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-header h2 { font-size: 20px; font-weight: 600; color: #303133; margin: 0; }
.search-form { margin-bottom: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px; }
.pagination { margin-top: 20px; display: flex; justify-content: center; }
.form-help { color: var(--text-secondary); font-size: 12px; }
.address-preview { overflow-wrap: anywhere; }
</style>

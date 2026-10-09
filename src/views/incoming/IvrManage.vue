<template>
  <div class="page-card">
    <div class="page-header">
      <h2>IVR管理</h2>
      <el-button type="primary" @click="handleAdd">
        <el-icon><Plus /></el-icon>
        新增
      </el-button>
    </div>

    <el-form :model="searchForm" inline class="search-form">
      <el-form-item label="IVR名称">
        <el-input v-model="searchForm.name" placeholder="IVR名称" clearable @keyup.enter="handleSearch" />
      </el-form-item>
      <el-form-item label="类型">
        <el-select v-model="searchForm.type" placeholder="全部" clearable style="width: 120px">
          <el-option label="转接" :value="1" />
          <el-option label="咨询" :value="2" />
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
      <el-table-column label="序号" width="60" align="center">
        <template #default="{ $index }">{{ (pagination.currentPage - 1) * pagination.pageSize + $index + 1 }}</template>
      </el-table-column>
      <el-table-column prop="name" label="IVR名称" min-width="200" show-overflow-tooltip />
      <el-table-column label="类型" width="90" align="center">
        <template #default="{ row }">
          <el-tag size="small" :type="row.type === 1 ? 'primary' : 'warning'">
            {{ row.type === 1 ? '转接' : row.type === 2 ? '咨询' : '-' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="110" align="center">
        <template #default="{ row }">
          <el-tag size="small" :type="statusTag(row.status)">{{ statusMap[row.status] || '-' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" width="170" align="center">
        <template #default="{ row }">{{ formatTime(row.uts) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="160" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
          <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination">
      <el-pagination
        background
        layout="total, sizes, prev, pager, next"
        :total="pagination.total"
        :current-page="pagination.currentPage"
        :page-size="pagination.pageSize"
        :page-sizes="[10, 20, 50]"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>

    <!-- 新增/编辑抽屉 -->
    <el-drawer v-model="dialogVisible" :title="isEdit ? '编辑IVR' : '新增IVR'" direction="rtl" size="92%" :close-on-click-modal="false" @close="resetForm">
      <div class="editor-form">
        <el-form :model="form" :rules="rules" ref="formRef" inline label-width="80px">
          <el-form-item label="名称" prop="name">
            <el-input v-model="form.name" placeholder="IVR名称" style="width: 200px" />
          </el-form-item>
          <el-form-item label="类型" prop="type">
            <el-select v-model="form.type" style="width: 120px">
              <el-option label="转接" :value="1" />
              <el-option label="咨询" :value="2" />
            </el-select>
          </el-form-item>
          <el-form-item label="状态" prop="status">
            <el-select v-model="form.status" style="width: 130px">
              <el-option v-for="(label, val) in statusMap" :key="val" :label="label" :value="Number(val)" />
            </el-select>
          </el-form-item>
        </el-form>

        <IvrFlowEditor ref="editorRef" :model-value="form.content" />
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitLoading">保存</el-button>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getIvrList, saveIvr, updateIvr, deleteIvr } from '@/api/config'
import IvrFlowEditor from '@/components/IvrFlowEditor.vue'

const loading = ref(false)
const submitLoading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref()
const editorRef = ref()
const list = ref([])
const searchForm = reactive({ name: '', type: '' })
const pagination = reactive({ currentPage: 1, pageSize: 10, total: 0 })
const form = reactive({ id: null, name: '', type: 1, status: 1, content: '' })

const statusMap = { 1: '待发布', 2: '审核中', 3: '审核未通过', 4: '审核通过', 5: '已上线' }
const statusTag = (v) => v === 5 ? 'success' : v === 4 ? 'primary' : v === 2 ? 'warning' : v === 3 ? 'danger' : 'info'
const rules = {
  name: [{ required: true, message: '请输入IVR名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }]
}

const formatTime = (ts) => ts ? new Date(ts * 1000).toLocaleString('zh-CN', { hour12: false }) : '-'

const loadData = async () => {
  loading.value = true
  try {
    const res = await getIvrList({
      pageNum: pagination.currentPage,
      pageSize: pagination.pageSize,
      query: JSON.stringify({ name: searchForm.name || undefined, type: searchForm.type || undefined })
    })
    if (res.code === 0) {
      list.value = res.data?.list || []
      pagination.total = res.data?.total || 0
    }
  } catch { /* ignore */ }
  finally { loading.value = false }
}

const handleSearch = () => { pagination.currentPage = 1; loadData() }
const handleReset = () => { searchForm.name = ''; searchForm.type = ''; pagination.currentPage = 1; loadData() }
const handleSizeChange = () => loadData()
const handleCurrentChange = () => loadData()

const resetForm = () => {
  formRef.value?.resetFields()
  Object.assign(form, { id: null, name: '', type: 1, status: 1, content: '' })
  isEdit.value = false
}

const handleAdd = () => { resetForm(); dialogVisible.value = true }

const handleEdit = (row) => {
  isEdit.value = true
  Object.assign(form, { id: row.id, name: row.name, type: row.type ?? 1, status: row.status ?? 1, content: row.content || '' })
  dialogVisible.value = true
}

const handleSubmit = async () => {
  if (!formRef.value) return
  try { await formRef.value.validate() } catch { return }
  submitLoading.value = true
  try {
    const content = editorRef.value?.getContent() || '{}'
    const data = { name: form.name, type: form.type, status: form.status, content }
    if (isEdit.value) await updateIvr(form.id, data)
    else await saveIvr(data)
    ElMessage.success(isEdit.value ? '修改成功' : '新增成功')
    dialogVisible.value = false
    loadData()
  } catch { ElMessage.error('操作失败') }
  finally { submitLoading.value = false }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确认删除IVR "${row.name}" 吗？`, '提示', { type: 'warning' })
    await deleteIvr(row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch { /* cancelled */ }
}

onMounted(loadData)
</script>

<style scoped>
.pagination { margin-top: 20px; display: flex; justify-content: flex-end; }
.editor-form { display: flex; flex-direction: column; height: calc(100vh - 160px); }
.editor-form .el-form { margin-bottom: 12px; }
</style>

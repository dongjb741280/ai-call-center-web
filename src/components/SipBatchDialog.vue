<template>
  <el-dialog :model-value="modelValue" title="批量创建 SIP 分机" width="min(760px, 94vw)"
    :show-close="!busy" :close-on-click-modal="false" :close-on-press-escape="!busy"
    @update:model-value="close" @closed="reset">
    <p class="batch-help">按连续号码创建分机，归属当前登录账号绑定的企业。已有号码会跳过，不修改密码或坐席绑定。</p>
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" :disabled="busy || started">
      <el-row :gutter="16">
        <el-col :xs="24" :sm="12">
          <el-form-item label="开始号码" prop="start"><el-input v-model="form.start" placeholder="950001" maxlength="10" /></el-form-item>
        </el-col>
        <el-col :xs="24" :sm="12">
          <el-form-item label="结束号码" prop="end"><el-input v-model="form.end" placeholder="950010" maxlength="10" /></el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="初始密码" prop="password">
        <el-input v-model="form.password" type="password" show-password autocomplete="new-password" placeholder="8–16 个字符" maxlength="16" />
      </el-form-item>
    </el-form>
    <div class="batch-toolbar">
      <span>{{ rangeSummary }}</span>
      <el-button v-if="!started" :loading="checking" :disabled="busy" @click="checkNumbers">检查号码</el-button>
    </div>
    <el-alert v-if="errorMessage" :title="errorMessage" type="error" :closable="false" show-icon />
    <template v-if="rows.length">
      <p class="batch-summary" aria-live="polite">
        共 {{ rows.length }} 个 · 已存在 {{ count('exists') }} 个 · 已创建 {{ count('success') }} 个 · 待创建 {{ count('pending') }} 个
        <span v-if="count('failed')"> · 失败 {{ count('failed') }} 个</span>
        <span v-if="count('uncertain')"> · 待确认 {{ count('uncertain') }} 个</span>
      </p>
      <el-progress v-if="busy || started" :percentage="progress" :status="hasFailure ? 'exception' : undefined" />
      <el-table :data="rows" row-key="sip" max-height="280" size="small">
        <el-table-column prop="sip" label="分机号" width="140" />
        <el-table-column label="状态" width="130">
          <template #default="{ row }"><el-tag :type="statusInfo[row.status].type">{{ statusInfo[row.status].label }}</el-tag></template>
        </el-table-column>
        <el-table-column label="说明" min-width="230">
          <template #default="{ row }">{{ row.message || (row.status === 'exists' ? '跳过，保留原配置' : '—') }}</template>
        </el-table-column>
      </el-table>
    </template>
    <el-alert v-if="started && !busy" class="result-note" :type="hasFailure || stopRequested ? 'warning' : 'success'" :closable="false" show-icon
      :title="hasFailure || stopRequested ? '本批已停止，已创建的分机保留。请核对结果后重新检查未完成的号码。' : '本批创建完成。已有号码未作修改。'" />
    <template #footer>
      <el-button v-if="busy" :disabled="stopRequested" @click="stopRequested = true">{{ stopRequested ? '正在停止…' : '停止后续操作' }}</el-button>
      <el-button v-else @click="close(false)">{{ started ? '关闭' : '取消' }}</el-button>
      <el-button v-if="started && !busy" @click="reset">新建批次</el-button>
      <el-button v-if="!started" type="primary" :disabled="!checked || busy || !count('pending')" @click="submit">
        创建 {{ count('pending') }} 个分机
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { ElMessage } from 'element-plus'
import { addSip, getSipList } from '@/api/config'
import { buildSipRange, checkSipBatch, createSipBatch, sipNumberError, sipPasswordError } from '@/utils/sipProvisioning'

defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue', 'created'])
const formRef = ref()
const form = reactive({ start: '', end: '', password: '' })
const rows = ref([])
const checking = ref(false)
const creating = ref(false)
const checked = ref(false)
const started = ref(false)
const stopRequested = ref(false)
const errorMessage = ref('')
const busy = computed(() => checking.value || creating.value)
const count = status => rows.value.filter(row => row.status === status).length
const hasFailure = computed(() => rows.value.some(row => ['failed', 'uncertain', 'checkFailed'].includes(row.status)))
const progress = computed(() => {
  const unfinished = checking.value ? ['unchecked', 'checking'] : ['unchecked', 'checking', 'pending', 'creating']
  const finished = rows.value.filter(row => !unfinished.includes(row.status)).length
  return rows.value.length ? Math.round(finished / rows.value.length * 100) : 0
})
const rangeSummary = computed(() => {
  try { return `共 ${buildSipRange(form.start, form.end).length} 个分机（每批最多 100 个）` }
  catch { return '每批最多 100 个分机，创建前请先检查号码。' }
})
const validator = check => (_rule, value, callback) => {
  const error = check(value)
  callback(error ? new Error(error) : undefined)
}
const rules = {
  start: [{ validator: validator(sipNumberError), trigger: 'blur' }],
  end: [{ validator: validator(sipNumberError), trigger: 'blur' }],
  password: [{ validator: validator(sipPasswordError), trigger: 'blur' }]
}
const statusInfo = {
  unchecked: { label: '待检查', type: 'info' }, checking: { label: '检查中', type: 'info' },
  pending: { label: '待创建', type: 'info' }, exists: { label: '已存在', type: 'warning' },
  creating: { label: '创建中', type: 'primary' }, success: { label: '已创建', type: 'success' },
  failed: { label: '创建失败', type: 'danger' }, uncertain: { label: '结果待确认', type: 'danger' },
  checkFailed: { label: '检查失败', type: 'danger' }
}

watch([() => form.start, () => form.end], () => {
  if (!busy.value && !started.value) { rows.value = []; checked.value = false; errorMessage.value = '' }
}, { flush: 'sync' })

async function checkNumbers() {
  if (busy.value) return
  checking.value = true
  checked.value = false
  errorMessage.value = ''
  try {
    if (!await formRef.value?.validate().catch(() => false)) return
    rows.value = buildSipRange(form.start, form.end).map(sip => ({ sip, status: 'unchecked', message: '' }))
    stopRequested.value = false
    checked.value = await checkSipBatch(rows.value, getSipList, () => stopRequested.value)
    if (stopRequested.value) errorMessage.value = '检查已停止，尚未创建分机。请重新检查。'
  } catch (error) { errorMessage.value = error.message || '检查号码失败' }
  finally { checking.value = false }
}

async function submit() {
  if (busy.value || started.value || !checked.value) return
  creating.value = true
  stopRequested.value = false
  try {
    if (!await formRef.value?.validate().catch(() => false)) return
    started.value = true
    await createSipBatch(rows.value, form.password, addSip, () => stopRequested.value)
  } catch (error) {
    errorMessage.value = error.message || '批量创建失败'
  } finally {
    creating.value = false
    if (started.value) {
      form.password = ''
      emit('created')
    }
  }
}

function close(value) { if (!busy.value) emit('update:modelValue', value) }
function reset() {
  if (busy.value) return
  started.value = false
  checked.value = false
  stopRequested.value = false
  errorMessage.value = ''
  rows.value = []
  Object.assign(form, { start: '', end: '', password: '' })
  formRef.value?.clearValidate()
}
function guardUnload(event) {
  if (busy.value) { event.preventDefault(); event.returnValue = '' }
}
onBeforeRouteLeave(() => {
  if (busy.value) { ElMessage.warning('请先停止批量操作，再离开页面'); return false }
})
onMounted(() => window.addEventListener('beforeunload', guardUnload))
onBeforeUnmount(() => {
  stopRequested.value = true
  window.removeEventListener('beforeunload', guardUnload)
})
</script>

<style scoped>
.batch-help { margin: 0 0 20px; color: var(--text-secondary); line-height: 1.6; }
.batch-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; }
.batch-summary { margin: 16px 0 12px; }
.result-note { margin-top: 16px; }
</style>

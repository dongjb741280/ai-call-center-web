<template>
  <div class="page-card">
    <div class="page-header">
      <h2>外呼报表</h2>
    </div>

    <el-form :model="searchForm" inline class="search-form">
      <el-form-item label="callId">
        <el-input v-model="searchForm.callId" placeholder="callId" clearable />
      </el-form-item>
      <el-form-item label="被叫号码">
        <el-input v-model="searchForm.called" placeholder="被叫号码" clearable />
      </el-form-item>
      <el-form-item label="时间">
        <el-date-picker
          v-model="searchForm.timeRange"
          type="datetimerange"
          range-separator="—"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          format="YYYY-MM-DD HH:mm:ss"
          value-format="x"
          clearable
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch"><el-icon><Search /></el-icon>搜索</el-button>
        <el-button @click="handleReset"><el-icon><Refresh /></el-icon>重置</el-button>
      </el-form-item>
    </el-form>

    <div class="table-wrapper">
      <el-table :data="list" v-loading="loading" size="small" style="width:100%">
        <el-table-column prop="callId" label="callId" width="200" show-overflow-tooltip />
        <el-table-column prop="caller" label="主叫号码" width="120" />
        <el-table-column prop="callerDisplay" label="外显号码" width="130" />
        <el-table-column prop="called" label="被叫号码" width="130" />
        <el-table-column prop="numberLocation" label="归属地" min-width="110" show-overflow-tooltip />
        <el-table-column prop="agentCode" label="坐席" width="80" align="center">
          <template #default="{ row }">{{ row.agentCode || row.agentKey }}</template>
        </el-table-column>
        <el-table-column label="技能组" width="100" show-overflow-tooltip>
          <template #default="{ row }">{{ row.groupId || '-' }}</template>
        </el-table-column>
        <el-table-column label="拨打时间" width="170">
          <template #default="{ row }">{{ formatTime(row.callTime) }}</template>
        </el-table-column>
        <el-table-column label="应答时间" width="170">
          <template #default="{ row }">{{ formatTime(row.answerTime) }}</template>
        </el-table-column>
        <el-table-column label="结束时间" width="170">
          <template #default="{ row }">{{ formatTime(row.endTime) }}</template>
        </el-table-column>
        <el-table-column label="通话时长" width="90" align="center">
          <template #default="{ row }">{{ fmtDur(row.talkTime) }}</template>
        </el-table-column>
        <el-table-column prop="callType" label="通话类型" width="130" show-overflow-tooltip />
        <el-table-column label="呼叫结果" width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ callResult(row) }}</template>
        </el-table-column>
        <el-table-column label="挂机" width="80" align="center">
          <template #default="{ row }">{{ row.hangupDir === 1 ? '主叫' : row.hangupDir === 2 ? '被叫' : '-' }}</template>
        </el-table-column>
        <el-table-column prop="hangupCode" label="挂机原因" width="150" show-overflow-tooltip />
        <el-table-column prop="ext2" label="sip状态" width="80" align="center" />
        <el-table-column prop="ext1" label="服务评价" width="80" align="center" />
        <el-table-column label="录音时长" width="90" align="center">
          <template #default="{ row }">{{ fmtDur(row.recordTime) }}</template>
        </el-table-column>
        <el-table-column label="录音" width="80" align="center">
          <template #default="{ row }">
            <el-button v-if="row.record" size="small" type="primary" link @click="playRecording(row)">
              <el-icon><VideoPlay /></el-icon>播放
            </el-button>
            <span v-else>无录音</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right" align="center">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="handleDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="pagination">
      <el-pagination v-model:current-page="pagination.currentPage" v-model:page-size="pagination.pageSize"
        :page-sizes="[10,20,50,100]" :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange" @current-change="handleCurrentChange" />
    </div>

    <CallReportDialogs ref="reportDialogs" />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { getCallMonitorList } from '@/api/config'
import CallReportDialogs from '@/components/CallReportDialogs.vue'
import { VideoPlay } from '@element-plus/icons-vue'
import { formatCallTime as formatTime, formatCallDuration as fmtDur } from '@/utils/cdrTime'

const loading = ref(false)
const list = ref([])
const searchForm = reactive({ callId: '', called: '', timeRange: null })
const pagination = reactive({ currentPage: 1, pageSize: 10, total: 0 })
const reportDialogs = ref(null)
const playRecording = row => reportDialogs.value.playRecording(row)
const handleDetail = row => reportDialogs.value.handleDetail(row)

const callResult = (row) => {
  if (row.answerFlag === 1) return '接通'
  if (row.endTime > 0) return '坐席未接用户未接'
  return '-'
}

const loadData = async () => {
  loading.value = true
  try {
    const query = { direction: 'OUTBOUND' }
    if (searchForm.callId) query.callId = searchForm.callId
    if (searchForm.called) query.called = searchForm.called
    if (searchForm.timeRange && searchForm.timeRange.length === 2) {
      query.start = Number(searchForm.timeRange[0])
      query.end = Number(searchForm.timeRange[1])
    }
    const params = { pageNum: pagination.currentPage, pageSize: pagination.pageSize,
      query: JSON.stringify(query) }
    const res = await getCallMonitorList(params)
    if (res.code === 0) { list.value = res.data?.list || []; pagination.total = res.data?.total || 0 }
  } catch { /* empty */ }
  finally { loading.value = false }
}

const handleSearch = () => { pagination.currentPage = 1; loadData() }
const handleReset = () => { Object.assign(searchForm, { callId: '', called: '', timeRange: null }); pagination.currentPage = 1; loadData() }
const handleSizeChange = () => loadData()
const handleCurrentChange = () => loadData()

onMounted(loadData)
</script>

<style scoped>
.table-wrapper { overflow-x: auto; }
.pagination { margin-top: 20px; display: flex; justify-content: center; }
</style>

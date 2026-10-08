<template>
  <div class="page-card">
    <div class="page-header">
      <h2>坐席监控</h2>
      <div class="header-right">
        <span class="refresh-time">{{ refreshTime }}</span>
        <el-button :icon="Refresh" circle size="small" @click="loadData" :loading="loading" />
      </div>
    </div>

    <el-form :model="searchForm" inline class="search-form">
      <el-form-item label="坐席">
        <el-input v-model="searchForm.agentKey" placeholder="坐席账号" clearable @keyup.enter="handleSearch" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch"><el-icon><Search /></el-icon>搜索</el-button>
        <el-button @click="handleReset"><el-icon><Refresh /></el-icon>重置</el-button>
      </el-form-item>
    </el-form>

    <div class="stats-bar" v-if="list.length > 0">
      <span class="stat-item">坐席总数 <strong>{{ list.length }}</strong></span>
      <span class="stat-sep">|</span>
      <span class="stat-item ready">空闲 <strong>{{ list.filter(a => a.state === 'READY').length }}</strong></span>
      <span class="stat-item notready">忙碌 <strong>{{ list.filter(a => a.state === 'NOT_READY').length }}</strong></span>
      <span class="stat-item outcall">通话中 <strong>{{ list.filter(a => a.state === 'OUT_CALL').length }}</strong></span>
      <span class="stat-item logout">离线 <strong>{{ list.filter(a => a.state === 'LOGOUT').length }}</strong></span>
    </div>

    <div class="card-grid" v-loading="loading">
      <div class="agent-card" v-for="agent in list" :key="agent.agentKey" :class="cardClass(agent.state)">
        <div class="card-top">
          <span class="card-agent-key">{{ agent.agentKey }}</span>
          <span class="card-type" :class="agent.loginType === 1 ? 'webrtc' : 'sip'">
            {{ agent.loginType === 1 ? 'webRTC' : 'SIP' }}
          </span>
        </div>
        <div class="card-state">
          <span class="state-dot" :class="stateDot(agent.state)"></span>
          <span class="state-label">{{ agent.state || 'LOGOUT' }}</span>
        </div>
        <div class="card-time">{{ formatTime(agent.stateTime) }}</div>
        <div class="card-name">{{ agent.agentName }}</div>
      </div>
      <el-empty v-if="!loading && list.length === 0" description="暂无坐席数据" />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { getAgentMonitorList } from '@/api/config'

const loading = ref(false)
const list = ref([])
const searchForm = reactive({ agentKey: '' })
const refreshTime = ref('')
let timer = null

const cardClass = (s) => {
  const m = { READY: 'card-ready', NOT_READY: 'card-notready', LOGIN: 'card-login', LOGOUT: 'card-logout', OUT_CALL: 'card-outcall' }
  return m[s] || 'card-default'
}
const stateDot = (s) => {
  const m = { READY: 'dot-ready', NOT_READY: 'dot-notready', LOGIN: 'dot-login', LOGOUT: 'dot-logout', OUT_CALL: 'dot-outcall' }
  return m[s] || 'dot-default'
}

const formatTime = (ts) => {
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleString('zh-CN', { hour12: false })
}

const loadData = async () => {
  loading.value = true
  try {
    const params = {}
    if (searchForm.agentKey) params.agentKey = searchForm.agentKey
    const res = await getAgentMonitorList(params)
    list.value = res.code === 0 ? (res.data || []) : []
    refreshTime.value = new Date().toLocaleString('zh-CN', { hour12: false })
  } catch { /* empty */ }
  finally { loading.value = false }
}

const handleSearch = () => loadData()
const handleReset = () => { searchForm.agentKey = ''; loadData() }

onMounted(() => { loadData(); timer = setInterval(loadData, 10000) })
onUnmounted(() => { clearInterval(timer) })
</script>

<style scoped>
.header-right { display: flex; align-items: center; gap: 12px; }
.refresh-time { font-size: 13px; color: var(--text-secondary); }

.stats-bar { display: flex; align-items: center; gap: 16px; padding: 12px 20px; background: #fff; border-radius: 8px; border: 1px solid var(--border-color-light); margin-bottom: 16px; font-size: 14px; color: var(--text-regular); }
.stat-item strong { font-size: 18px; margin-left: 4px; }
.stat-item.ready strong { color: var(--color-success); }
.stat-item.notready strong { color: var(--color-danger); }
.stat-item.outcall strong { color: var(--color-warning); }
.stat-item.logout strong { color: var(--text-secondary); }
.stat-sep { color: var(--border-color); }

.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; min-height: 200px; }

.agent-card {
  padding: 16px 20px;
  border-radius: 8px;
  border: 1px solid var(--border-color-light);
  background: #fff;
  transition: box-shadow 0.2s;
}
.agent-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.08); }

.card-ready { border-left: 4px solid var(--color-success); }
.card-notready { border-left: 4px solid var(--color-danger); }
.card-login { border-left: 4px solid var(--color-primary); }
.card-logout { border-left: 4px solid var(--text-secondary); }
.card-outcall { border-left: 4px solid var(--color-warning); }
.card-default { border-left: 4px solid var(--border-color); }

.card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.card-agent-key { font-size: 15px; font-weight: 600; color: var(--text-primary); }
.card-type { font-size: 12px; padding: 1px 8px; border-radius: 4px; color: #fff; }
.card-type.webrtc { background: var(--color-primary); }
.card-type.sip { background: var(--text-secondary); }

.card-state { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.state-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.dot-ready { background: var(--color-success); box-shadow: 0 0 6px rgba(103,194,58,0.5); }
.dot-notready { background: var(--color-danger); box-shadow: 0 0 6px rgba(245,108,108,0.5); }
.dot-login { background: var(--color-primary); box-shadow: 0 0 6px rgba(64,158,255,0.5); }
.dot-logout { background: var(--text-secondary); }
.dot-outcall { background: var(--color-warning); box-shadow: 0 0 6px rgba(230,162,60,0.5); }
.dot-default { background: var(--text-placeholder); }
.state-label { font-size: 14px; color: var(--text-regular); font-weight: 500; }

.card-time { font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }
.card-name { font-size: 13px; color: var(--text-regular); }
</style>

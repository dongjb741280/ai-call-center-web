<template>
  <div class="ivr-editor">
    <!-- 左侧节点面板 -->
    <div class="palette">
      <div class="palette-title">节点</div>
      <div
        v-for="p in palette"
        :key="p.type"
        class="palette-item"
        draggable="true"
        @dragstart="onDragStart($event, p.type)"
      >
        <span class="palette-dot" :style="{ background: p.color }"></span>
        <span>{{ p.label }}</span>
      </div>
      <el-button size="small" class="auto-layout-btn" @click="autoLayout">自动布局</el-button>
    </div>

    <!-- 中间画布 -->
    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      :default-edge-options="edgeOptions"
      :node-types="nodeTypes"
      class="flow"
      @connect="onConnect"
      @node-click="onNodeClick"
      @edge-click="onEdgeClick"
      @pane-click="clearSelection"
      @drop="onDrop"
      @dragover.prevent
    >
      <template #node-play="props">
        <PlayNode v-bind="props" />
      </template>
      <template #node-input="props">
        <InputNode v-bind="props" />
      </template>
      <template #node-transfer="props">
        <TransferNode v-bind="props" />
      </template>
    </VueFlow>

    <!-- 右侧属性面板 -->
    <div class="props">
      <div class="props-title">{{ selectedNode ? '节点属性' : selectedEdge ? '分支属性' : '属性' }}</div>

      <template v-if="selectedNode">
        <el-form label-width="80px" size="small">
          <el-form-item label="类型">
            <el-tag size="small">{{ typeLabel(selectedNode.type) }}</el-tag>
          </el-form-item>

          <template v-if="selectedNode.type === 'play' || selectedNode.type === 'input'">
            <el-form-item label="音频文件">
              <el-select v-model="selectedNode.data.file" placeholder="选择音频" style="width: 100%" filterable>
                <el-option v-for="a in audioList" :key="a.playback" :label="a.name" :value="a.playback" />
              </el-select>
            </el-form-item>
          </template>

          <template v-if="selectedNode.type === 'input'">
            <el-form-item label="最大键长">
              <el-input-number v-model="selectedNode.data.maxDigits" :min="1" :max="32" style="width: 100%" />
            </el-form-item>
            <el-form-item label="超时(秒)">
              <el-input-number v-model="selectedNode.data.timeout" :min="1" :max="60" style="width: 100%" />
            </el-form-item>
            <el-form-item label="超时去向">
              <el-select v-model="selectedNode.data.defaultNext" placeholder="选择节点" style="width: 100%" clearable>
                <el-option
                  v-for="n in nodes.filter(x => x.id !== selectedNode.id)"
                  :key="n.id"
                  :label="`${typeLabel(n.type)} (${n.id})`"
                  :value="n.id"
                />
              </el-select>
            </el-form-item>
          </template>

          <template v-if="selectedNode.type === 'transfer'">
            <el-form-item label="转接类型">
              <el-select v-model="selectedNode.data.targetType" style="width: 100%">
                <el-option label="挂机" value="hangup" />
                <el-option label="技能组" value="group" />
                <el-option label="VDN" value="vdn" />
                <el-option label="坐席" value="agent" />
              </el-select>
            </el-form-item>
            <el-form-item v-if="selectedNode.data.targetType === 'group'" label="技能组">
              <el-select v-model="selectedNode.data.targetValue" placeholder="选择技能组" style="width: 100%" filterable>
                <el-option v-for="g in groupList" :key="g.id" :label="g.name" :value="String(g.id)" />
              </el-select>
            </el-form-item>
            <el-form-item v-else-if="selectedNode.data.targetType === 'vdn'" label="VDN">
              <el-select v-model="selectedNode.data.targetValue" placeholder="选择VDN" style="width: 100%" filterable>
                <el-option v-for="v in vdnList" :key="v.id" :label="v.name" :value="String(v.id)" />
              </el-select>
            </el-form-item>
            <el-form-item v-else-if="selectedNode.data.targetType === 'agent'" label="坐席">
              <el-select v-model="selectedNode.data.targetValue" placeholder="选择坐席" style="width: 100%" filterable>
                <el-option v-for="a in agentList" :key="a.agentKey" :label="a.agentName || a.agentKey" :value="a.agentKey" />
              </el-select>
            </el-form-item>
          </template>

          <el-button type="danger" size="small" plain style="width: 100%" @click="removeSelectedNode">删除节点</el-button>
        </el-form>
      </template>

      <template v-else-if="selectedEdge">
        <el-form label-width="80px" size="small">
          <el-form-item label="按键值">
            <el-input v-model="selectedEdge.label" maxlength="4" placeholder="如 1 / 2 / #" />
          </el-form-item>
          <div class="hint">input 节点出发的连线 label 即按键分支值；play/transfer 的连线无需按键值。</div>
          <el-button type="danger" size="small" plain style="width: 100%" @click="removeSelectedEdge">删除连线</el-button>
        </el-form>
      </template>

      <el-empty v-else description="点击节点或连线编辑" :image-size="60" />
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, h } from 'vue'
import { VueFlow, Handle, Position, MarkerType, useVueFlow } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import { getPlaybackList, getGroupConfigList, getVdnList, getAgentConfigList } from '@/api/config'

const props = defineProps({
  modelValue: { type: String, default: '' }
})

const { addNodes, addEdges, removeNodes, removeEdges, screenToFlowCoordinate, fitView } = useVueFlow()

const nodes = ref([])
const edges = ref([])
const selectedNode = ref(null)
const selectedEdge = ref(null)

const audioList = ref([])
const groupList = ref([])
const vdnList = ref([])
const agentList = ref([])

const edgeOptions = { type: 'smoothstep', markerEnd: MarkerType.ArrowClosed }

const palette = [
  { type: 'play', label: '放音', color: '#3b82f6' },
  { type: 'input', label: '收键', color: '#667eea' },
  { type: 'transfer', label: '转接', color: '#f59e0b' },
]

const typeLabel = (t) => ({ play: '放音', input: '收键', transfer: '转接' }[t] || t)

let idCtr = 0
const newId = (prefix = 'n') => `${prefix}${Date.now().toString(36)}_${++idCtr}`
const newEdgeId = () => `e${Date.now().toString(36)}_${++idCtr}`

// 自定义节点组件（用 h() 渲染，避免依赖运行时模板编译器）
const makeNodeComponent = (typeClass, title, descFn, withSource = true) => ({
  props: ['data', 'selected'],
  setup(props) {
    return () => {
      const children = [
        h(Handle, { type: 'target', position: Position.Left }),
        h('div', { class: 'node-title' }, title),
        h('div', { class: 'node-desc' }, descFn(props.data)),
      ]
      if (withSource) children.push(h(Handle, { type: 'source', position: Position.Right }))
      return h('div', { class: ['node-card', typeClass, { selected: props.selected }] }, children)
    }
  }
})

const PlayNode = makeNodeComponent('play', '🎵 放音', (d) => d.file || '未选音频')
const InputNode = makeNodeComponent('input', '☎ 收键', (d) => `${d.file || '未选音频'} · ${d.maxDigits}位 · ${d.timeout}s`)
const TransferNode = makeNodeComponent('transfer', '➜ 转接', (d) => {
  const m = { hangup: '挂机', group: '技能组', vdn: 'VDN', agent: '坐席' }
  const t = m[d.targetType] || '挂机'
  return d.targetValue ? `${t}: ${d.targetValue}` : t
}, false)

const nodeTypes = { play: PlayNode, input: InputNode, transfer: TransferNode }

const onDragStart = (event, type) => {
  event.dataTransfer.setData('application/vueflow', type)
  event.dataTransfer.effectAllowed = 'move'
}

const onDrop = (event) => {
  const type = event.dataTransfer.getData('application/vueflow')
  if (!type) return
  const position = screenToFlowCoordinate({ x: event.clientX, y: event.clientY })
  addNodes([makeNode(type, position)])
}

const makeNode = (type, position) => {
  const base = { id: newId(), type, position, data: {} }
  if (type === 'play') base.data = { file: '' }
  else if (type === 'input') base.data = { file: '', maxDigits: 1, timeout: 5, defaultNext: '' }
  else if (type === 'transfer') base.data = { targetType: 'hangup', targetValue: '' }
  return base
}

const onConnect = (params) => {
  const sourceNode = nodes.value.find(n => n.id === params.source)
  const label = sourceNode?.type === 'input' ? String(nextBranchKey(params.source)) : ''
  addEdges([{ ...params, id: newEdgeId(), label }])
}

const nextBranchKey = (sourceId) => {
  const used = edges.value.filter(e => e.source === sourceId).map(e => e.label)
  for (let i = 1; i <= 9; i++) { if (!used.includes(String(i))) return i }
  return 0
}

const onNodeClick = ({ node }) => { selectedNode.value = node; selectedEdge.value = null }
const onEdgeClick = ({ edge }) => { selectedEdge.value = edge; selectedNode.value = null }
const clearSelection = () => { selectedNode.value = null; selectedEdge.value = null }

const removeSelectedNode = () => {
  if (!selectedNode.value) return
  removeNodes([selectedNode.value.id])
  removeEdges(edges.value.filter(e => e.source === selectedNode.value.id || e.target === selectedNode.value.id).map(e => e.id))
  selectedNode.value = null
}

const removeSelectedEdge = () => {
  if (!selectedEdge.value) return
  removeEdges([selectedEdge.value.id])
  selectedEdge.value = null
}

const autoLayout = () => {
  nodes.value.forEach((n, i) => {
    n.position = { x: 60, y: 40 + i * 130 }
  })
}

// ==================== 序列化 / 反序列化 ====================
const deserialize = (content) => {
  nodes.value = []
  edges.value = []
  selectedNode.value = null
  selectedEdge.value = null
  if (!content) return
  let def
  try { def = JSON.parse(content) } catch { return }
  if (!def || !Array.isArray(def.nodes)) return

  def.nodes.forEach((n, i) => {
    const data = { file: n.file || '', maxDigits: n.maxDigits ?? 1, timeout: n.timeout ?? 5, defaultNext: n.defaultNext || '', targetType: n.targetType || 'hangup', targetValue: n.targetValue || '' }
    nodes.value.push({ id: n.id || newId(), type: n.type, position: { x: 60, y: 40 + i * 130 }, data })
  })

  def.nodes.forEach(n => {
    if (n.type === 'play' && n.next) {
      edges.value.push({ id: newEdgeId(), source: n.id, target: n.next, label: '' })
    } else if (n.type === 'input') {
      ;(n.branches || []).forEach(b => {
        edges.value.push({ id: newEdgeId(), source: n.id, target: b.next, label: b.key || '' })
      })
    }
  })
}

const getContent = () => {
  const incoming = new Set(edges.value.map(e => e.target))
  const start = nodes.value.find(n => !incoming.has(n.id))
  const startNode = start ? start.id : (nodes.value[0]?.id || '')

  const outBySource = {}
  edges.value.forEach(e => { (outBySource[e.source] = outBySource[e.source] || []).push(e) })

  const resultNodes = nodes.value.map(n => {
    const out = outBySource[n.id] || []
    if (n.type === 'play') {
      return { id: n.id, type: 'play', file: n.data.file || '', next: out[0]?.target || '' }
    } else if (n.type === 'input') {
      return {
        id: n.id, type: 'input', file: n.data.file || '',
        maxDigits: n.data.maxDigits ?? 1, timeout: n.data.timeout ?? 5,
        branches: out.map(e => ({ key: e.label || '', next: e.target })),
        defaultNext: n.data.defaultNext || ''
      }
    } else {
      return { id: n.id, type: 'transfer', targetType: n.data.targetType || 'hangup', targetValue: n.data.targetValue || '' }
    }
  })

  return JSON.stringify({ startNode, nodes: resultNodes })
}

const loadResources = async () => {
  try {
    const [a, g, v, ag] = await Promise.all([
      getPlaybackList({ pageNum: 1, pageSize: 500 }),
      getGroupConfigList({ pageNum: 1, pageSize: 500 }),
      getVdnList({ pageNum: 1, pageSize: 500 }),
      getAgentConfigList({ pageNum: 1, pageSize: 500 }),
    ])
    audioList.value = a?.data?.list || a?.data || []
    groupList.value = g?.data?.list || g?.data || []
    vdnList.value = v?.data?.list || v?.data || []
    agentList.value = ag?.data?.list || ag?.data || []
  } catch { /* 资源加载失败不阻塞编辑 */ }
}

watch(() => props.modelValue, (v) => deserialize(v), { immediate: true })

onMounted(() => {
  loadResources()
  setTimeout(() => fitView({ padding: 0.2 }), 100)
})

defineExpose({ getContent, deserialize })
</script>

<style scoped>
.ivr-editor {
  display: flex;
  height: 100%;
  min-height: 520px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
}
.palette {
  width: 120px;
  border-right: 1px solid #e5e7eb;
  background: #fafafa;
  padding: 10px;
  flex-shrink: 0;
}
.palette-title { font-size: 13px; color: #666; margin-bottom: 8px; }
.palette-item {
  display: flex; align-items: center; gap: 6px;
  padding: 8px; margin-bottom: 6px; border: 1px solid #e5e7eb;
  border-radius: 4px; background: #fff; cursor: grab; font-size: 13px;
}
.palette-dot { width: 10px; height: 10px; border-radius: 50%; }
.auto-layout-btn { margin-top: 8px; width: 100%; }
.flow { flex: 1; background: #fdfdfd; }
.props {
  width: 260px; border-left: 1px solid #e5e7eb; background: #fafafa;
  padding: 10px; overflow-y: auto; flex-shrink: 0;
}
.props-title { font-size: 13px; color: #666; margin-bottom: 10px; }
.hint { font-size: 12px; color: #999; margin: 6px 0 10px; }

:deep(.node-card) {
  min-width: 130px; border: 1px solid #d1d5db; border-radius: 6px;
  background: #fff; padding: 8px 10px; font-size: 12px; box-shadow: 0 1px 3px rgba(0,0,0,.08);
}
:deep(.node-card.selected) { border-color: #409eff; box-shadow: 0 0 0 2px rgba(64,158,255,.2); }
:deep(.node-card.play) .node-title { color: #3b82f6; }
:deep(.node-card.input) .node-title { color: #667eea; }
:deep(.node-card.transfer) .node-title { color: #f59e0b; }
:deep(.node-title) { font-weight: 600; }
:deep(.node-desc) { color: #6b7280; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 120px; }
</style>

<template>
  <span class="secret-text">
    <span>{{ value ? (visible ? value : '••••••••') : '—' }}</span>
    <el-button v-if="value" link :aria-label="visible ? '隐藏密码' : '显示密码'" :aria-pressed="visible" @click="visible = !visible">
      <el-icon><Hide v-if="visible" /><View v-else /></el-icon>
    </el-button>
  </span>
</template>

<script setup>
import { ref, watch } from 'vue'
import { Hide, View } from '@element-plus/icons-vue'
const props = defineProps({ value: { type: String, default: '' } })
const visible = ref(false)
watch(() => props.value, () => { visible.value = false })
</script>

<style scoped>
.secret-text { display: inline-flex; align-items: center; gap: 8px; }
</style>

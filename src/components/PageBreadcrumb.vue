<template>
  <nav aria-label="当前位置" class="page-breadcrumb">
    <el-breadcrumb separator="/">
      <el-breadcrumb-item :to="route.path === '/' ? undefined : '/'">控制台</el-breadcrumb-item>
      <el-breadcrumb-item v-for="item in items" :key="item.path">{{ item.meta.title }}</el-breadcrumb-item>
    </el-breadcrumb>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
const route = useRoute()
// Menu groups have no landing page, so only the dashboard is a link.
const items = computed(() => route.matched.filter(item => item.meta?.title && item.name !== 'Dashboard'))
</script>

<style scoped>
.page-breadcrumb { padding-bottom: var(--space-md, 16px); }
.page-breadcrumb :deep(.el-breadcrumb) { line-height: 1.6; }
</style>

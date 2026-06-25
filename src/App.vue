<template>
  <div id="app-root">
    <!-- 加载动画 -->
    <div v-if="loading" class="app-loading">
      <div class="loading-spinner"></div>
      <p>加载中...</p>
    </div>

    <!-- 主内容 -->
    <div v-else class="app-content">
      <!-- 导航栏 -->
      <nav class="app-nav">
        <div class="nav-brand">萌力互动</div>
        <div class="nav-links">
          <router-link to="/">首页</router-link>
          <router-link to="/media">媒体库</router-link>
          <router-link to="/copy">文案</router-link>
        </div>
      </nav>

      <!-- 路由视图 -->
      <router-view />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { state } from './core/state.js';

const loading = ref(true);

onMounted(() => {
  // 模拟初始化
  setTimeout(() => {
    loading.value = false;
  }, 500);
});
</script>

<style scoped>
.app-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  font-family: system-ui, -apple-system, sans-serif;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #F4845F;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.app-nav {
  display: flex;
  align-items: center;
  padding: 12px 24px;
  background: white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.nav-brand {
  font-weight: 700;
  font-size: 18px;
  margin-right: 32px;
}

.nav-links {
  display: flex;
  gap: 16px;
}

.nav-links a {
  text-decoration: none;
  color: #666;
  font-size: 14px;
}

.nav-links a.router-link-active {
  color: #F4845F;
  font-weight: 600;
}
</style>

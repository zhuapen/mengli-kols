<template>
  <div class="login-modal" v-if="visible" @click.self="close">
    <div class="login-modal-content">
      <div class="login-modal-header">
        <h3>🔐 登录</h3>
        <button class="login-modal-close" @click="close">×</button>
      </div>
      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label>邮箱</label>
          <input
            type="email"
            v-model="email"
            placeholder="请输入邮箱"
            required
            autocomplete="email"
          >
        </div>
        <div class="form-group">
          <label>密码</label>
          <input
            type="password"
            v-model="password"
            placeholder="请输入密码"
            required
            autocomplete="current-password"
          >
        </div>
        <div class="login-error" v-if="error">{{ error }}</div>
        <button type="submit" class="login-submit-btn" :disabled="loading">
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const visible = ref(false);
const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

function open() {
  visible.value = true;
  error.value = '';
  email.value = '';
  password.value = '';
}

function close() {
  visible.value = false;
}

async function handleSubmit() {
  if (!email.value || !password.value) {
    error.value = '请输入邮箱和密码';
    return;
  }

  error.value = '';
  loading.value = true;

  try {
    const data = await apiClient.auth.login(email.value, password.value);
    close();
    // 调用 legacy 的 handleLogin 完成后续初始化
    if (typeof handleLogin === 'function') {
      await handleLogin(data.user);
    }
  } catch (e) {
    error.value = e.message || '登录失败，请检查邮箱和密码';
  } finally {
    loading.value = false;
  }
}

// 暴露方法给父组件和 legacy 代码
defineExpose({ open, close });
</script>

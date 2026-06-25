<template>
  <div id="app-root">
    <!-- 导航栏 -->
    <nav class="app-nav">
      <div class="nav-brand" @click="$router.push('/')">
        <img src="/logo.jpg" alt="萌力互动" class="nav-logo">
        <span>萌力互动</span>
      </div>
      <div class="nav-links">
        <router-link to="/" class="nav-link">首页</router-link>
        <router-link to="/media" class="nav-link">📚 媒体库</router-link>
        <router-link to="/image" class="nav-link">图片生成</router-link>
        <router-link to="/copy" class="nav-link">文案撰写</router-link>
        <router-link to="/assets" class="nav-link">素材库</router-link>
        <router-link to="/datacenter" class="nav-link">数据中心</router-link>
        <router-link to="/history" class="nav-link">历史记录</router-link>
      </div>
      <div class="nav-user">
        <span v-if="user" class="user-name">👋 {{ user.display_name || user.email }}</span>
        <button v-if="user" @click="logout" class="btn-logout">退出</button>
        <button v-else @click="showLogin = true" class="btn-login">登录</button>
      </div>
    </nav>

    <!-- 路由视图 -->
    <main class="app-main">
      <router-view />
    </main>

    <!-- 登录弹窗 -->
    <div v-if="showLogin" class="login-modal" @click.self="showLogin = false">
      <div class="login-content">
        <div class="login-header">
          <h3>🔐 登录</h3>
          <button @click="showLogin = false" class="login-close">×</button>
        </div>
        <form @submit.prevent="handleLogin">
          <div class="form-group">
            <label>邮箱</label>
            <input v-model="loginForm.email" type="email" placeholder="请输入邮箱" required>
          </div>
          <div class="form-group">
            <label>密码</label>
            <input v-model="loginForm.password" type="password" placeholder="请输入密码" required>
          </div>
          <div v-if="loginError" class="login-error">{{ loginError }}</div>
          <button type="submit" class="btn-submit" :disabled="loginLoading">
            {{ loginLoading ? '登录中...' : '登录' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { post, get } from './core/request.js';
import { toast } from './core/utils/toast.js';

const user = ref(null);
const showLogin = ref(false);
const loginLoading = ref(false);
const loginError = ref('');
const loginForm = ref({ email: '', password: '' });

onMounted(async () => {
  const token = localStorage.getItem('mengli_token');
  if (token) {
    try {
      user.value = await get('/auth/me');
    } catch (e) {
      localStorage.removeItem('mengli_token');
    }
  }
});

async function handleLogin() {
  loginLoading.value = true;
  loginError.value = '';
  try {
    const data = await post('/auth/login', loginForm.value);
    localStorage.setItem('mengli_token', data.token);
    localStorage.setItem('mengli_user', JSON.stringify(data.user));
    user.value = data.user;
    showLogin.value = false;
    toast('登录成功', 'success');
  } catch (e) {
    loginError.value = e.message || '登录失败';
  } finally {
    loginLoading.value = false;
  }
}

function logout() {
  localStorage.removeItem('mengli_token');
  localStorage.removeItem('mengli_user');
  user.value = null;
  toast('已退出登录', 'success');
}
</script>

<style scoped>
.app-nav {
  display: flex;
  align-items: center;
  padding: 12px 24px;
  background: white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 18px;
  margin-right: 32px;
  cursor: pointer;
}

.nav-logo {
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

.nav-links {
  display: flex;
  gap: 16px;
  flex: 1;
}

.nav-link {
  text-decoration: none;
  color: #666;
  font-size: 14px;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s;
}

.nav-link:hover {
  background: #f5f5f5;
}

.nav-link.router-link-active {
  color: #F4845F;
  font-weight: 600;
  background: #FFF5F2;
}

.nav-user {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-name {
  font-size: 13px;
  color: #666;
}

.btn-login {
  padding: 8px 24px;
  background: #F4845F;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

.btn-logout {
  padding: 8px 16px;
  background: transparent;
  color: #666;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
}

.app-main {
  min-height: calc(100vh - 60px);
}

/* 登录弹窗 */
.login-modal {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.login-content {
  background: white;
  border-radius: 16px;
  padding: 32px;
  max-width: 400px;
  width: 90%;
}

.login-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.login-header h3 {
  margin: 0;
}

.login-close {
  background: none;
  border: none;
  font-size: 28px;
  cursor: pointer;
  color: #666;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
}

.form-group input {
  width: 100%;
  padding: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: #F4845F;
}

.login-error {
  color: #EF4444;
  font-size: 14px;
  margin-bottom: 16px;
}

.btn-submit {
  width: 100%;
  padding: 14px;
  background: #F4845F;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
}

.btn-submit:disabled {
  opacity: 0.6;
}
</style>

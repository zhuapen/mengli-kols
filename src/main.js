/**
 * 萌力互动 · 模块入口
 * Vite 入口文件，按依赖顺序导入所有模块
 */

// ===== 状态管理 =====
import './store/state.js';

// ===== 工具函数 =====
import './utils/toast.js';
import './utils/markdown.js';

// ===== 功能模块 =====
import './features/register.js';

// ===== 事件委托 =====
import './events.js';

// ===== Vue 应用 =====
import './vue/app.js';

// ===== 状态同步 =====
(function syncGlobalState() {
  if (typeof window.appState === 'undefined') return;
  const state = window.appState;

  // 初始化 state
  if (typeof currentPage !== 'undefined') state.currentPage = currentPage;
  if (typeof currentPlatform !== 'undefined') state.currentPlatform = currentPlatform;
  if (typeof activeTag !== 'undefined') state.activeTag = activeTag;
  if (typeof currentUser !== 'undefined') state.currentUser = currentUser;
  if (typeof userProfile !== 'undefined') state.userProfile = userProfile;

  // 拦截 showPage
  if (typeof showPage === 'function') {
    const _origShowPage = showPage;
    window.showPage = function(page) {
      state.currentPage = page;
      return _origShowPage(page);
    };
  }

  // 拦截 handleLogin
  if (typeof handleLogin === 'function') {
    const _origHandleLogin = handleLogin;
    window.handleLogin = function(user) {
      state.currentUser = user;
      return _origHandleLogin(user);
    };
  }

  // 拦截 handleLogout
  if (typeof handleLogout === 'function') {
    const _origHandleLogout = handleLogout;
    window.handleLogout = function() {
      state.currentUser = null;
      state.userProfile = null;
      state.userPermissions = [];
      return _origHandleLogout();
    };
  }

  console.log('[main] 全局状态同步完成');
})();

console.log('[main] 模块入口已加载');

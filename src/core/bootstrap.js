/**
 * 萌力互动 · 系统启动控制器
 * 控制启动顺序，错误隔离
 */
import { initRequest } from './request.js';
import { initState } from './state.js';
import { initToast } from './utils/toast.js';
import { API } from './config.js';

export function bootstrap() {
  console.log('[boot] 开始初始化...');

  // 全局错误兜底
  window.onerror = function (msg, src, line, col, err) {
    console.error('[全局错误]', msg, src, line, err);
    return false;
  };

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Promise 错误]', event.reason);
  });

  try {
    // 1. 初始化配置
    console.log('[boot] 1/5 配置初始化');

    // 2. 初始化请求层
    initRequest({
      getToken: () => localStorage.getItem('mengli_token'),
      onUnauthorized: () => {
        console.warn('[boot] 会话已过期');
      },
    });
    console.log('[boot] 2/5 请求层初始化');

    // 3. 初始化状态
    initState();
    console.log('[boot] 3/5 状态初始化');

    // 4. 初始化 Toast
    initToast();
    console.log('[boot] 4/5 Toast 初始化');

    // 5. 挂载 Vue 应用
    mountApp();
    console.log('[boot] 5/5 Vue 应用挂载');

    console.log('[boot] 初始化完成');
  } catch (err) {
    console.error('[boot] 启动失败:', err);
    // 不白屏，显示错误信息
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `
        <div style="padding:40px;text-align:center;font-family:system-ui">
          <h2 style="color:#EF4444">系统启动失败</h2>
          <p style="color:#666">${err.message}</p>
          <button onclick="location.reload()" style="padding:8px 16px;margin-top:16px;cursor:pointer">
            刷新页面
          </button>
        </div>
      `;
    }
  }
}

function mountApp() {
  // 动态导入 Vue 应用
  import('../main.js').then(module => {
    if (module.mountApp) {
      module.mountApp();
    }
  }).catch(err => {
    console.error('[boot] Vue 应用加载失败:', err);
  });
}

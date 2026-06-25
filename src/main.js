/**
 * 萌力互动 · Vue 应用挂载
 * 被 bootstrap.js 调用
 */
import { createApp } from 'vue';
import App from './App.vue';
import router from './router/index.js';

export function mountApp() {
  const app = createApp(App);

  // 安装路由
  app.use(router);

  // 全局错误处理
  app.config.errorHandler = (err, instance, info) => {
    console.error('[Vue 错误]', err, info);
  };

  // 挂载到 #app
  const mountEl = document.getElementById('app');
  if (mountEl) {
    app.mount(mountEl);
    console.log('[main] Vue 应用已挂载');

    // 隐藏旧系统
    const legacyApp = document.getElementById('legacy-app');
    if (legacyApp) legacyApp.style.display = 'none';
  } else {
    console.error('[main] 找不到 #app 元素');
  }
}

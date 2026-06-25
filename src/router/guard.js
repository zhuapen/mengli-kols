/**
 * 萌力互动 · 路由守卫
 * 统一管理路由跳转逻辑
 */

/**
 * 设置路由守卫
 * @param {Router} router - Vue Router 实例
 */
export function setupGuard(router) {
  router.beforeEach((to, from, next) => {
    // 检查是否需要登录
    const token = localStorage.getItem('mengli_token');

    if (to.meta.requiresAuth && !token) {
      console.warn('[guard] 未登录，跳转首页');
      next('/');
      return;
    }

    // 检查权限（可扩展）
    if (to.meta.permission) {
      // TODO: 检查用户权限
    }

    next();
  });

  router.afterEach((to, from) => {
    // 页面切换后更新标题
    const title = to.meta.title || '萌力互动 AI 创作平台';
    document.title = title;
  });

  router.onError((err) => {
    console.error('[Router 错误]', err);
  });
}

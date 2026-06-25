/**
 * 萌力互动 · 初始化锁
 * 解决 Vue 组件在 core 初始化完成前访问 core 的竞态问题
 */

let ready = false;
const queue = [];

/**
 * 等待系统就绪后执行
 * 如果已就绪，立即执行；否则排队等待
 */
export function waitUntilReady(fn) {
  if (ready) {
    try { fn(); } catch (e) { console.error('[initLock] 执行失败:', e); }
    return;
  }
  queue.push(fn);
}

/**
 * 标记系统就绪，执行所有排队的函数
 */
export function setReady() {
  ready = true;
  queue.forEach(fn => {
    try { fn(); } catch (e) { console.error('[initLock] 排队任务执行失败:', e); }
  });
  queue.length = 0;
  console.log('[initLock] 系统就绪');
}

/**
 * 检查是否就绪
 */
export function isReady() {
  return ready;
}

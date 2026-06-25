/**
 * 萌力互动 · Toast 通知
 * 不依赖全局变量
 */

let toastInstance = null;

export function registerToast(instance) {
  toastInstance = instance;
}

export function toast(message, type = 'info') {
  if (!toastInstance) {
    console.warn('[toast 未初始化]', message);
    return;
  }

  if (typeof toastInstance === 'function') {
    toastInstance(message, type);
    return;
  }

  if (toastInstance.add) {
    toastInstance.add({ message, type });
  }
}

// 初始化 Notyf
export function initToast() {
  if (typeof Notyf === 'undefined') {
    console.warn('[toast] Notyf 未加载，使用 fallback');
    registerToast((msg) => console.log('[toast]', msg));
    return;
  }

  const notyf = new Notyf({
    duration: 3000,
    position: { x: 'right', y: 'top' },
    types: [
      { type: 'success', background: '#10B981', icon: { className: 'notyf__icon', tagName: 'span', text: '✓' } },
      { type: 'error', background: '#EF4444', icon: { className: 'notyf__icon', tagName: 'span', text: '✗' } },
      { type: 'warning', background: '#F59E0B', icon: { className: 'notyf__icon', tagName: 'span', text: '⚠' } },
    ],
  });

  registerToast((msg, type) => {
    if (type === 'error') notyf.error(msg);
    else if (type === 'warning') notyf.open({ type: 'warning', message: msg });
    else notyf.success(msg);
  });
}

// 向后兼容
export function showToast(msg, type) {
  toast(msg, type);
}

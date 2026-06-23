/**
 * 萌力互动 · Toast 通知
 * 从 app.js 提取
 */

let notyf = null;
try {
  notyf = new Notyf({
    duration: 3000,
    position: { x: 'right', y: 'top' },
    types: [
      { type: 'success', background: '#10B981', icon: { className: 'notyf__icon', tagName: 'span', text: '✓' } },
      { type: 'error', background: '#EF4444', icon: { className: 'notyf__icon', tagName: 'span', text: '✗' } },
      { type: 'warning', background: '#F59E0B', icon: { className: 'notyf__icon', tagName: 'span', text: '⚠' } }
    ]
  });
} catch (e) { console.warn('Notyf 加载失败，使用 fallback:', e); }

export function showToast(msg, type) {
  if (notyf) {
    if (type === 'error') notyf.error(msg);
    else if (type === 'warning') notyf.open({ type: 'warning', message: msg });
    else notyf.success(msg);
  } else {
    alert(msg);
  }
}

// 暴露到全局
window.showToast = showToast;

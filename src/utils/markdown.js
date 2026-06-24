/**
 * 萌力互动 · Markdown 渲染 + 安全工具
 * 从 app.js 提取
 */

export function renderMarkdown(text) {
  if (!text) return '';
  try {
    if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
      const html = marked.parse(text, { breaks: true, gfm: true });
      return DOMPurify.sanitize(html);
    }
  } catch (e) { console.warn('Markdown 渲染失败，使用纯文本:', e); }
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// 暴露到全局
window.renderMarkdown = renderMarkdown;
window.escapeHtml = escapeHtml;

/**
 * 萌力互动 · Markdown 渲染
 * 不依赖全局变量
 */

export function renderMarkdown(text = '') {
  if (!text) return '';

  try {
    if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
      const html = marked.parse(text, { breaks: true, gfm: true });
      return DOMPurify.sanitize(html);
    }
  } catch (e) {
    console.warn('[markdown] 渲染失败:', e);
  }

  // fallback
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function escapeHtml(str = '') {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// 向后兼容
if (typeof window !== 'undefined') {
  window.renderMarkdown = renderMarkdown;
  window.escapeHtml = escapeHtml;
}

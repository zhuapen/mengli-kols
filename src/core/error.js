/**
 * 萌力互动 · 统一错误处理
 * 所有错误通过此文件出口
 */
import { toast } from './utils/toast.js';

/**
 * 统一错误处理
 * @param {Error} err - 错误对象
 * @param {string} context - 错误上下文（如 "API", "Vue", "Router"）
 * @param {object} options - 额外选项
 */
export function handleError(err, context = '', options = {}) {
  const prefix = context ? `[${context}]` : '[ERROR]';

  // 1. 控制台日志
  console.error(prefix, err);

  // 2. 用户提示（可关闭）
  if (!options.silent) {
    const message = getUserMessage(err, context);
    toast(message, 'error');
  }

  // 3. 可扩展：上报日志服务
  // reportToLogger(err, context, options);
}

/**
 * 获取用户友好的错误信息
 */
function getUserMessage(err, context) {
  if (err.status === 401) return '会话已过期，请重新登录';
  if (err.status === 403) return '权限不足';
  if (err.status === 404) return '请求的资源不存在';
  if (err.status === 429) return '请求过于频繁，请稍后重试';
  if (err.status === 500) return '服务器内部错误';
  if (err.status === 502 || err.status === 503) return '服务暂时不可用';
  if (err.message === '网络连接失败') return '网络连接失败，请检查网络';
  if (err.message === 'Failed to fetch') return '网络连接失败';

  if (context === 'API') return '请求失败，请稍后重试';
  if (context === 'Vue') return '页面渲染异常';
  if (context === 'Router') return '页面跳转异常';

  return '系统异常，请稍后重试';
}

/**
 * 萌力互动 · 统一 API 请求层
 * 所有 HTTP 请求通过此文件
 */
import { API } from './config.js';

let getToken = () => localStorage.getItem('mengli_token');
let onUnauthorized = null;

export function initRequest(options = {}) {
  if (options.getToken) getToken = options.getToken;
  if (options.onUnauthorized) onUnauthorized = options.onUnauthorized;
}

export async function request(path, options = {}) {
  const token = getToken();
  const url = path.startsWith('http') ? path : `${API.base}${path}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const config = {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  };

  try {
    const response = await fetch(url, config);

    if (response.status === 401) {
      localStorage.removeItem('mengli_token');
      localStorage.removeItem('mengli_user');
      if (onUnauthorized) onUnauthorized();
      throw new ApiError(401, '会话已过期，请重新登录');
    }

    if (response.status === 204) return null;

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new ApiError(
        response.status,
        data.detail || data.message || `请求失败 ${response.status}`
      );
    }

    // 统一响应格式 {code, msg, data}
    if (data && typeof data.code !== 'undefined') {
      if (data.code === 0) return data.data;
      throw new ApiError(data.code, data.msg || '请求失败');
    }

    return data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error('[request] 网络错误:', err);
    throw new ApiError(0, '网络连接失败');
  }
}

export async function stream(path, body, onChunk, onDone, onError) {
  const token = getToken();
  const url = path.startsWith('http') ? path : `${API.base}${path}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) throw new ApiError(response.status, `HTTP ${response.status}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') { onDone(); return; }
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) onChunk(parsed.text);
          } catch (e) { /* ignore */ }
        }
      }
    }
    onDone();
  } catch (err) {
    onError(err);
  }
}

// 便捷方法
export const get = (path, opts) => request(path, { ...opts, method: 'GET' });
export const post = (path, body, opts) => request(path, { ...opts, method: 'POST', body });
export const put = (path, body, opts) => request(path, { ...opts, method: 'PUT', body });
export const del = (path, opts) => request(path, { ...opts, method: 'DELETE' });

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

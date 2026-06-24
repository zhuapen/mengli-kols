/**
 * 萌力互动 · 统一 API 客户端
 * 所有 API 调用通过此文件进行
 * - 自动注入 token
 * - 统一错误处理
 * - 语义化方法命名
 *
 * API_BASE 由 config.js 统一管理（window.MENGLI.API_BASE）
 */

(function() {
  'use strict';

  const API_BASE = window.MENGLI ? window.MENGLI.API_BASE : '';

  // ===== 错误类 =====
  class ApiError extends Error {
    constructor(status, message, detail) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.detail = detail;
    }
  }

  // ===== 底层请求 =====
  async function apiRequest(method, path, options = {}) {
    const token = localStorage.getItem('mengli_token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
      ...options.headers,
    };

    const config = {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    };

    const response = await fetch(API_BASE + path, config);

    if (response.status === 401) {
      localStorage.removeItem('mengli_token');
      localStorage.removeItem('mengli_user');
      localStorage.removeItem('session_token');
      // 不自动刷新，避免无限循环
      throw new ApiError(401, '会话已过期，请重新登录');
    }

    if (response.status === 204) return null;

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ApiError(
        response.status,
        data.detail || data.message || '请求失败 ' + response.status,
        data.detail
      );
    }
    // 统一响应格式 {code, msg, data} → 返回 data 字段
    if (data && typeof data.code !== 'undefined' && data.code === 0) {
      return data.data;
    }
    // 错误响应
    if (data && typeof data.code !== 'undefined' && data.code !== 0) {
      throw new ApiError(data.code, data.msg || '请求失败');
    }
    // 兼容旧格式
    return data;
  }

  // 流式请求
  async function apiStream(path, body, onChunk, onDone, onError) {
    try {
      const token = localStorage.getItem('mengli_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
      };

      const resp = await fetch(API_BASE + path, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!resp.ok) throw new ApiError(resp.status, 'HTTP ' + resp.status);
      const reader = resp.body.getReader();
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
            } catch (e) { /* 忽略解析错误 */ }
          }
        }
      }
      onDone();
    } catch (e) {
      onError(e);
    }
  }

  // 便捷方法
  function get(path, opts) { return apiRequest('GET', path, opts); }
  function post(path, body, opts) { return apiRequest('POST', path, { body, ...opts }); }
  function put(path, body, opts) { return apiRequest('PUT', path, { body, ...opts }); }
  function del(path, opts) { return apiRequest('DELETE', path, opts); }

  // ===== 认证模块 =====
  const auth = {
    login: function(email, password) {
      return post('/auth/login', { email, password }).then(function(data) {
        localStorage.setItem('mengli_token', data.token);
        localStorage.setItem('mengli_user', JSON.stringify(data.user));
        return data;
      });
    },
    logout: function() {
      return post('/auth/logout').catch(function() {}).then(function() {
        localStorage.removeItem('mengli_token');
        localStorage.removeItem('mengli_user');
        localStorage.removeItem('session_token');
      });
    },
    register: function(data) {
      return post('/auth/register', data);
    },
    me: function() {
      return get('/auth/me');
    },
    updateProfile: function(data) {
      return put('/auth/profile', data);
    },
  };

  // ===== 管理员模块 =====
  const admin = {
    listUsers: function() {
      return get('/admin/users');
    },
    createUser: function(data) {
      return post('/admin/users', data);
    },
    updateUser: function(userId, data) {
      return put('/admin/users/' + userId, data);
    },
    deleteUser: function(userId) {
      return del('/admin/users/' + userId);
    },
    approveUser: function(userId) {
      return put('/admin/users/' + userId + '/approve');
    },
    rejectUser: function(userId) {
      return put('/admin/users/' + userId + '/reject');
    },
    toggleUser: function(userId) {
      return put('/admin/users/' + userId + '/toggle');
    },
    getPermissions: function(userId) {
      return get('/admin/users/' + userId + '/permissions');
    },
    updatePermissions: function(userId, featureKeys) {
      return put('/admin/users/' + userId + '/permissions', { permissions: featureKeys });
    },
    logAction: function(action, target, details) {
      return post('/admin/log', { action: action, target: target, details: details }).catch(function() {});
    },
  };

  // ===== 权限模块 =====
  const permissions = {
    features: function() {
      return get('/permissions/features');
    },
    my: function() {
      return get('/permissions/my');
    },
  };

  // ===== 历史记录模块 =====
  var historyApi = {
    list: function(genType, limit) {
      var url = '/history?limit=' + (limit || 50);
      if (genType && genType !== 'all') url += '&gen_type=' + genType;
      return get(url);
    },
    create: function(data) {
      return post('/history', data);
    },
    updateRating: function(id, rating) {
      return put('/history/' + id + '/rating', { rating: rating });
    },
    softDelete: function(id) {
      return put('/history/' + id + '/soft-delete');
    },
    getHighRated: function(genType, limit) {
      return get('/history/high-rated?gen_type=' + (genType || 'copywriting') + '&limit=' + (limit || 3));
    },
  };

  // ===== 资产模块 =====
  var assetsApi = {
    list: function() {
      return get('/assets');
    },
    create: function(data) {
      return post('/assets', data);
    },
    updateRating: function(id, rating) {
      return put('/assets/' + id + '/rating', { rating: rating });
    },
    batchDelete: function(ids) {
      return del('/assets/batch', { body: JSON.stringify({ ids: ids }) });
    },
  };

  // ===== 品牌模块 =====
  var brands = {
    list: function() {
      return get('/brands');
    },
    save: function(data) {
      return post('/brands', data);
    },
    delete: function(id) {
      return del('/brands/' + id);
    },
  };

  // ===== 模板模块 =====
  var templates = {
    list: function() {
      return get('/templates');
    },
    save: function(data) {
      return post('/templates', data);
    },
    delete: function(id) {
      return del('/templates/' + id);
    },
  };

  // ===== 偏好模块 =====
  var preferences = {
    list: function() {
      return get('/preferences');
    },
    save: function(key, value) {
      return post('/preferences', { pref_key: key, pref_value: value });
    },
  };

  // ===== 反馈模块 =====
  var feedbackApi = {
    list: function() {
      return get('/feedback');
    },
    save: function(data) {
      return post('/feedback', data);
    },
  };

  // ===== 插件反馈模块 =====
  var pluginFeedback = {
    list: function() {
      return get('/plugin-feedback');
    },
    submit: function(data) {
      return post('/plugin-feedback', data);
    },
    updateStatus: function(id, status) {
      return put('/plugin-feedback/' + id + '/status', { status: status });
    },
    delete: function(id) {
      return del('/plugin-feedback/' + id);
    },
  };

  // ===== 插件模块（原 supabase.from 调用）=====
  var plugins = {
    list: function() {
      return get('/plugins');
    },
    get: function(id) {
      return get('/plugins/' + id);
    },
    incrementDownload: function(id) {
      return put('/plugins/' + id + '/download');
    },
    create: function(data) {
      return post('/plugins', data);
    },
    update: function(id, data) {
      return put('/plugins/' + id, data);
    },
    delete: function(id) {
      return del('/plugins/' + id);
    },
  };

  // ===== AI 业务模块（原 fetch('/api') 调用）=====
  var ai = {
    copywriting: function(params) {
      return post('/api', { action: 'copywriting', ...params });
    },
    streamCopywriting: function(params, onChunk, onDone, onError) {
      return apiStream('/api', { action: 'stream_copywriting', ...params }, onChunk, onDone, onError);
    },
    imageEdit: function(params) {
      return post('/api', { ...params, action: params.action || 'image_edit' });
    },
    uploadImage: function(fileBase64, filename) {
      return post('/api', { action: 'upload_image_file', file_base64: fileBase64, filename: filename });
    },
    kolSearch: function(query, platform) {
      return post('/api', { action: 'kol_search', query: query, platform: platform });
    },
    analyzeKol: function(images) {
      return post('/api', { action: 'analyze_kol', images: images });
    },
    streamArticle: function(params, file, onChunk, onDone, onError) {
      var body = { action: 'stream_article', ...params };
      if (file) body.file = { name: file.name, base64: file.base64, type: file.type };
      return apiStream('/api', body, onChunk, onDone, onError);
    },
    article: function(params, file) {
      var body = { action: 'article', ...params };
      if (file) body.file = { name: file.name, base64: file.base64, type: file.type };
      return post('/api', body);
    },
    streamRefine: function(params, onChunk, onDone, onError) {
      return apiStream('/api', { action: 'stream_refine', ...params }, onChunk, onDone, onError);
    },
    feedback: function(params) {
      return post('/api', { action: 'feedback', ...params });
    },
    createUser: function(data) {
      return post('/api', { action: 'create_user', ...data });
    },
  };

  // ===== 文件上传（FormData 方式）=====
  var upload = {
    image: function(file) {
      var token = localStorage.getItem('mengli_token');
      var formData = new FormData();
      formData.append('file', file);
      return fetch(API_BASE + '/upload/image', {
        method: 'POST',
        headers: token ? { 'Authorization': 'Bearer ' + token } : {},
        body: formData,
      }).then(function(resp) {
        return resp.json();
      });
    },
  };

  // ===== 组装 apiClient =====
  window.apiClient = {
    request: apiRequest,
    get: get,
    post: post,
    put: put,
    del: del,
    stream: apiStream,
    ApiError: ApiError,

    auth: auth,
    admin: admin,
    permissions: permissions,
    history: historyApi,
    assets: assetsApi,
    brands: brands,
    templates: templates,
    preferences: preferences,
    feedback: feedbackApi,
    pluginFeedback: pluginFeedback,
    plugins: plugins,
    ai: ai,
    upload: upload,
  };

  // ===== 向后兼容 =====

  // 旧 apiCall 兼容（auth.js 中使用）
  window.apiCall = function(path, options) {
    return apiRequest(options.method || 'GET', path, options);
  };

  // 旧 apiRequest 兼容（api-client.js 内部使用）
  window.apiRequest = apiRequest;

  // 旧 Supabase 兼容层
  var legacyAuth = {
    signInWithPassword: function(opts) {
      return auth.login(opts.email, opts.password).then(function(data) {
        return { data: { session: { user: data.user }, user: data.user }, error: null };
      });
    },
    signOut: function() {
      return auth.logout().then(function() { return { error: null }; });
    },
    getSession: function() {
      var token = localStorage.getItem('mengli_token');
      var userStr = localStorage.getItem('mengli_user');
      if (!token || !userStr) return Promise.resolve({ data: { session: null }, error: null });
      try {
        var user = JSON.parse(userStr);
        return Promise.resolve({ data: { session: { user: user, access_token: token } }, error: null });
      } catch (e) {
        return Promise.resolve({ data: { session: null }, error: null });
      }
    },
    onAuthStateChange: function(callback) {
      var token = localStorage.getItem('mengli_token');
      var userStr = localStorage.getItem('mengli_user');
      if (token && userStr) {
        try {
          var user = JSON.parse(userStr);
          setTimeout(function() { callback('SIGNED_IN', { user: user, access_token: token }); }, 100);
        } catch (e) { /* 忽略 */ }
      }
      return { data: { subscription: { unsubscribe: function() {} } } };
    },
  };

  // QueryBuilder 兼容（用于 supabase.from() 调用）
  function LegacyQueryBuilder(table) {
    this.table = table;
    this._filters = {};
    this._order = null;
    this._limit = null;
    this._single = false;
  }
  LegacyQueryBuilder.prototype.select = function() { return this; };
  LegacyQueryBuilder.prototype.eq = function(col, val) { this._filters[col] = val; return this; };
  LegacyQueryBuilder.prototype.order = function(col, opts) {
    this._order = { col: col, desc: opts && opts.ascending === false };
    return this;
  };
  LegacyQueryBuilder.prototype.limit = function(n) { this._limit = n; return this; };
  LegacyQueryBuilder.prototype.single = function() { this._single = true; return this; };
  LegacyQueryBuilder.prototype.then = function(resolve, reject) {
    // 映射到 apiClient.routes
    var self = this;
    var id = this._filters.id;

    if (this.table === 'plugins') {
      if (id) {
        plugins.get(id).then(function(data) {
          resolve({ data: self._single ? data : [data], error: null });
        }).catch(function(e) { resolve({ data: null, error: e }); });
      } else {
        plugins.list().then(function(data) {
          var result = data.plugins || data;
          if (self._limit) result = result.slice(0, self._limit);
          resolve({ data: result, error: null });
        }).catch(function(e) { resolve({ data: null, error: e }); });
      }
    } else if (this.table === 'plugin_changelog') {
      var pluginId = this._filters.plugin_id;
      plugins.get(pluginId).then(function(data) {
        resolve({ data: data.changelog || [], error: null });
      }).catch(function(e) { resolve({ data: null, error: e }); });
    } else {
      resolve({ data: null, error: new Error('不支持的表: ' + this.table) });
    }
  };

  function LegacyInsertBuilder(table, rows) {
    this.table = table;
    this.rows = rows;
  }
  LegacyInsertBuilder.prototype.select = function() { return this; };
  LegacyInsertBuilder.prototype.single = function() { return this; };
  LegacyInsertBuilder.prototype.then = function(resolve, reject) {
    if (this.table === 'plugin_feedback') {
      pluginFeedback.submit(this.rows).then(function(data) {
        resolve({ data: data, error: null });
      }).catch(function(e) { resolve({ data: null, error: e }); });
    } else {
      resolve({ data: null, error: new Error('不支持的表: ' + this.table) });
    }
  };

  function LegacyUpdateBuilder(table, values) {
    this.table = table;
    this.values = values;
    this._filters = {};
  }
  LegacyUpdateBuilder.prototype.eq = function(col, val) { this._filters[col] = val; return this; };
  LegacyUpdateBuilder.prototype.then = function(resolve, reject) {
    if (this.table === 'plugins' && this._filters.id) {
      plugins.incrementDownload(this._filters.id).then(function(data) {
        resolve({ data: data, error: null });
      }).catch(function(e) { resolve({ data: null, error: e }); });
    } else {
      resolve({ data: null, error: new Error('不支持的表: ' + this.table) });
    }
  };

  window.supabase = {
    createClient: function() {
      return {
        auth: legacyAuth,
        from: function(table) {
          return {
            select: function() { return new LegacyQueryBuilder(table); },
            insert: function(rows) { return new LegacyInsertBuilder(table, rows); },
            update: function(values) { return new LegacyUpdateBuilder(table, values); },
          };
        },
      };
    },
  };

  console.log('[api-client] 统一 API 客户端已加载');
})();

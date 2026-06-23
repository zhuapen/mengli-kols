/**
 * 萌力互动 · API 客户端
 * 替代 Supabase SDK，提供相同接口
 * API_BASE 由 config.js 统一管理
 */
const API_BASE = window.MENGLI ? window.MENGLI.API_BASE : '';

// ===== 通用请求 =====
async function apiRequest(path, options = {}) {
    const token = localStorage.getItem('mengli_token');
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const resp = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (resp.status === 401) {
        localStorage.removeItem('mengli_token');
        localStorage.removeItem('mengli_user');
        if (!path.includes('/auth/login') && !path.includes('/auth/register')) {
            window.location.reload();
        }
        throw new Error('会话已过期，请重新登录');
    }

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.detail || data.message || `HTTP ${resp.status}`);
    return data;
}

// ===== 认证 API =====
const authApi = {
    async signInWithPassword({ email, password }) {
        const data = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        localStorage.setItem('mengli_token', data.token);
        localStorage.setItem('mengli_user', JSON.stringify(data.user));
        return { data: { session: { user: data.user }, user: data.user }, error: null };
    },

    async signOut() {
        try { await apiRequest('/auth/logout', { method: 'POST' }); } catch (e) {}
        localStorage.removeItem('mengli_token');
        localStorage.removeItem('mengli_user');
        return { error: null };
    },

    async getSession() {
        const token = localStorage.getItem('mengli_token');
        const userStr = localStorage.getItem('mengli_user');
        if (!token || !userStr) return { data: { session: null }, error: null };
        try {
            const user = JSON.parse(userStr);
            return { data: { session: { user, access_token: token } }, error: null };
        } catch (e) {
            return { data: { session: null }, error: null };
        }
    },

    onAuthStateChange(callback) {
        // 简化版：不监听跨标签页变化
        const token = localStorage.getItem('mengli_token');
        const userStr = localStorage.getItem('mengli_user');
        if (token && userStr) {
            try {
                const user = JSON.parse(userStr);
                setTimeout(() => callback('SIGNED_IN', { user, access_token: token }), 100);
            } catch (e) {}
        }
        return { data: { subscription: { unsubscribe: () => {} } } };
    }
};

// ===== 数据库查询构建器 =====
class QueryBuilder {
    constructor(table, token) {
        this.table = table;
        this.token = token;
        this._select = '*';
        this._filters = [];
        this._order = null;
        this._limit = null;
        this._single = false;
    }

    select(cols = '*') { this._select = cols; return this; }
    eq(col, val) { this._filters.push(`${col}=eq.${val}`); return this; }
    neq(col, val) { this._filters.push(`${col}=neq.${val}`); return this; }
    gt(col, val) { this._filters.push(`${col}=gt.${val}`); return this; }
    gte(col, val) { this._filters.push(`${col}=gte.${val}`); return this; }
    lt(col, val) { this._filters.push(`${col}=lt.${val}`); return this; }
    lte(col, val) { this._filters.push(`${col}=lte.${val}`); return this; }
    like(col, val) { this._filters.push(`${col}=like.${val}`); return this; }
    ilike(col, val) { this._filters.push(`${col}=ilike.${val}`); return this; }
    is(col, val) { this._filters.push(`${col}=is.${val}`); return this; }
    in(col, vals) { this._filters.push(`${col}=in.(${vals.join(',')})`); return this; }
    order(col, opts = {}) {
        this._order = `${col}.${opts.ascending === false ? 'desc' : 'asc'}`;
        return this;
    }
    limit(n) { this._limit = n; return this; }
    single() { this._single = true; return this; }

    async then(resolve, reject) {
        try {
            let url = `/rest/v1/${this.table}?select=${this._select}`;
            if (this._filters.length) url += '&' + this._filters.join('&');
            if (this._order) url += `&order=${this._order}`;
            if (this._limit) url += `&limit=${this._limit}`;

            const headers = { 'apikey': this.token, 'Authorization': `Bearer ${this.token}` };
            const resp = await fetch(`${API_BASE}${url}`, { headers });
            let data = await resp.json();

            if (this._single) data = Array.isArray(data) ? data[0] : data;
            resolve({ data, error: null });
        } catch (e) {
            resolve({ data: null, error: e });
        }
    }
}

class InsertBuilder {
    constructor(table, rows, token, upsert = false) {
        this.table = table;
        this.rows = rows;
        this.token = token;
        this.upsert = upsert;
        this._select = null;
        this._single = false;
    }

    select(cols) { this._select = cols; return this; }
    single() { this._single = true; return this; }

    async then(resolve, reject) {
        try {
            let url = `/rest/v1/${this.table}`;
            const headers = {
                'apikey': this.token,
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json',
                'Prefer': this.upsert ? 'return=representation,resolution=merge-duplicates' : 'return=representation'
            };
            if (this._select) url += `?select=${this._select}`;

            const resp = await fetch(`${API_BASE}${url}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(this.rows)
            });
            let data = await resp.json();
            if (this._single) data = Array.isArray(data) ? data[0] : data;
            resolve({ data, error: null });
        } catch (e) {
            resolve({ data: null, error: e });
        }
    }
}

class UpdateBuilder {
    constructor(table, values, token) {
        this.table = table;
        this.values = values;
        this.token = token;
        this._filters = [];
        this._select = null;
        this._single = false;
    }

    select(cols) { this._select = cols; return this; }
    eq(col, val) { this._filters.push(`${col}=eq.${val}`); return this; }
    single() { this._single = true; return this; }

    async then(resolve, reject) {
        try {
            let url = `/rest/v1/${this.table}`;
            const params = this._filters.join('&');
            if (params) url += `?${params}`;
            if (this._select) url += `${params ? '&' : '?'}select=${this._select}`;

            const headers = {
                'apikey': this.token,
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            };

            const resp = await fetch(`${API_BASE}${url}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify(this.values)
            });
            let data = await resp.json();
            if (this._single) data = Array.isArray(data) ? data[0] : data;
            resolve({ data, error: null });
        } catch (e) {
            resolve({ data: null, error: e });
        }
    }
}

class DeleteBuilder {
    constructor(table, token) {
        this.table = table;
        this.token = token;
        this._filters = [];
    }

    eq(col, val) { this._filters.push(`${col}=eq.${val}`); return this; }
    in(col, vals) { this._filters.push(`${col}=in.(${vals.join(',')})`); return this; }

    async then(resolve, reject) {
        try {
            let url = `/rest/v1/${this.table}`;
            const params = this._filters.join('&');
            if (params) url += `?${params}`;

            const headers = { 'apikey': this.token, 'Authorization': `Bearer ${this.token}` };
            await fetch(`${API_BASE}${url}`, { method: 'DELETE', headers });
            resolve({ data: null, error: null });
        } catch (e) {
            resolve({ data: null, error: e });
        }
    }
}

// ===== 数据库模拟 =====
function createDbClient(token) {
    return {
        from(table) {
            return {
                select: (cols) => new QueryBuilder(table, token).select(cols),
                insert: (rows) => new InsertBuilder(table, rows, token),
                upsert: (rows) => new InsertBuilder(table, rows, token, true),
                update: (values) => new UpdateBuilder(table, values, token),
                delete: () => new DeleteBuilder(table, token)
            };
        }
    };
}

// ===== 存储模拟 =====
function createStorageClient(token) {
    return {
        from(bucket) {
            return {
                async upload(path, file) {
                    const formData = new FormData();
                    formData.append('file', file);
                    const resp = await fetch(`${API_BASE}/upload/image`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: formData
                    });
                    const data = await resp.json();
                    return { data: { path: data.url }, error: null };
                },
                getPublicUrl(path) {
                    return { data: { publicUrl: `${API_BASE}${path}` } };
                }
            };
        }
    };
}

// ===== 全局 Supabase 兼容对象 =====
// Token 每次请求时动态读取，避免登录后旧 token 问题
window.supabase = {
    createClient: function(url, key) {
        return {
            auth: authApi,
            from: (table) => createDbClient(localStorage.getItem('mengli_token') || key).from(table),
            storage: createStorageClient(localStorage.getItem('mengli_token') || key)
        };
    }
};

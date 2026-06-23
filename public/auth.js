/**
 * 萌力互动 · 权限管理系统
 * 基于自建 API 的用户认证和权限控制
 * 已彻底移除 Supabase 依赖
 * API_BASE 由 config.js 统一管理
 */

// ===== 配置 =====
const API_BASE = window.MENGLI ? window.MENGLI.API_BASE : '';

// ===== 状态 =====
let currentUser = null;
let userProfile = null;
let userPermissions = [];
let allFeatures = [];

// 预设岗位列表
const PRESET_POSITIONS = [
    'AE（客户执行）', 'AM（客户经理）', '策划', '媒介',
    '设计师', '文案', '视频剪辑', '总监', '主管', '实习生', '运营'
];

// ===== 通用 API 请求 =====
async function apiCall(path, options = {}) {
    const token = localStorage.getItem('mengli_token');
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const resp = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (resp.status === 401) {
        localStorage.removeItem('mengli_token');
        localStorage.removeItem('mengli_user');
        localStorage.removeItem('session_token');
        currentUser = null;
        userProfile = null;
        updateAuthUI();
        if (!path.includes('/auth/login')) {
            showToast('会话已过期，请重新登录', 'error');
        }
        throw new Error('未登录');
    }

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.detail || data.message || `请求失败 ${resp.status}`);
    return data;
}

// ===== 初始化认证系统 =====
async function initAuth() {
    try {
        const token = localStorage.getItem('mengli_token');
        const userStr = localStorage.getItem('mengli_user');

        if (token && userStr) {
            try {
                const user = JSON.parse(userStr);
                currentUser = user;
                await loadUserProfile();
                await loadUserPermissions();
                updateAuthUI();
                applyPermissions();
                console.log('认证系统初始化完成（已登录）');
            } catch (e) {
                console.warn('恢复登录状态失败:', e);
                localStorage.removeItem('mengli_token');
                localStorage.removeItem('mengli_user');
            }
        }

        await loadAllFeatures();
        return true;
    } catch (error) {
        console.error('认证系统初始化失败:', error);
        return false;
    }
}

// ===== 加载功能配置 =====
async function loadAllFeatures() {
    try {
        allFeatures = await apiCall('/permissions/features');
        if (Array.isArray(allFeatures)) {
            allFeatures = allFeatures;
        } else if (allFeatures.features) {
            allFeatures = allFeatures.features;
        }
    } catch (error) {
        console.error('加载功能配置失败:', error);
        allFeatures = [
            { feature_key: 'find', feature_name: '找号' },
            { feature_key: 'image_gen', feature_name: '图片生成' },
            { feature_key: 'copywriting', feature_name: '文案撰写' },
            { feature_key: 'article', feature_name: '推文生成' },
            { feature_key: 'assets', feature_name: '素材库' },
            { feature_key: 'knowledge', feature_name: '知识库' },
            { feature_key: 'plugin', feature_name: '数据中心' },
            { feature_key: 'history', feature_name: '历史记录' }
        ];
    }
}

// ===== 加载用户权限 =====
async function loadUserPermissions() {
    if (!currentUser) return;
    try {
        const data = await apiCall('/permissions/my');
        userPermissions = data.permissions || [];
    } catch (error) {
        console.error('加载用户权限失败:', error);
        userPermissions = [];
    }
}

// ===== 登录 =====
async function login(email, password) {
    try {
        const data = await apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        localStorage.setItem('mengli_token', data.token);
        localStorage.setItem('mengli_user', JSON.stringify(data.user));
        return { success: true, user: data.user };
    } catch (error) {
        console.error('登录失败:', error);
        return { success: false, error: error.message };
    }
}

// ===== 登出 =====
async function logout() {
    try {
        await apiCall('/auth/logout', { method: 'POST' });
    } catch (e) { /* 静默 */ }
    localStorage.removeItem('mengli_token');
    localStorage.removeItem('mengli_user');
    localStorage.removeItem('session_token');
    handleLogout();
    return { success: true };
}

// ===== 处理登录成功 =====
let _sessionCheckTimer = null;

async function handleLogin(user) {
    currentUser = user;
    console.log('用户已登录:', user.email);

    await loadUserProfile();

    const status = userProfile?.status || 'approved';
    if (status === 'pending') {
        await logout();
        showToast('您的账号正在审核中，请等待管理员审批后再登录', 'error');
        return;
    }
    if (status === 'rejected') {
        await logout();
        showToast('您的注册申请未通过审核，如有疑问请联系管理员', 'error');
        return;
    }
    if (status === 'disabled') {
        await logout();
        showToast('您的账号已被禁用，如有疑问请联系管理员', 'error');
        return;
    }

    await loadUserPermissions();
    updateAuthUI();
    applyPermissions();
}

// ===== 加载用户配置 =====
async function loadUserProfile() {
    if (!currentUser) return;
    try {
        userProfile = await apiCall('/auth/me');
    } catch (error) {
        console.error('加载用户配置失败:', error);
        userProfile = {
            id: currentUser.id,
            email: currentUser.email,
            display_name: currentUser.display_name || currentUser.email.split('@')[0],
            role: currentUser.role || 'user',
            position: currentUser.position || '未设置',
            is_active: true,
            status: currentUser.status || 'approved'
        };
    }
}

// ===== 处理登出 =====
function handleLogout() {
    if (_sessionCheckTimer) { clearInterval(_sessionCheckTimer); _sessionCheckTimer = null; }
    currentUser = null;
    userProfile = null;
    userPermissions = [];
    console.log('用户已登出');
    updateAuthUI();
    showPage('home');
}

// ===== 注册 =====
async function handleRegister(event) {
    event.preventDefault();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const name = document.getElementById('regName').value.trim();
    const position = document.getElementById('regPosition').value.trim();
    const errorEl = document.getElementById('registerError');
    const btn = document.getElementById('regSubmitBtn');

    if (!email || !password || !name || !position) {
        errorEl.textContent = '请填写所有必填项';
        return;
    }

    btn.disabled = true;
    btn.textContent = '注册中...';

    try {
        await apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, display_name: name, position })
        });
        showToast('注册成功，等待管理员审批', 'success');
        closeRegisterModal();
    } catch (error) {
        errorEl.textContent = error.message || '注册失败';
    } finally {
        btn.disabled = false;
        btn.textContent = '提交注册';
    }
}

// ===== 管理员：创建用户 =====
async function createUser(email, password, displayName, position) {
    if (!isAdmin()) return { success: false, error: '权限不足' };
    try {
        await apiCall('/admin/users', {
            method: 'POST',
            body: JSON.stringify({ email, password, display_name: displayName, position })
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ===== 管理员：更新用户信息 =====
async function updateUserProfile(userId, updates) {
    if (!isAdmin()) return { success: false, error: '权限不足' };
    try {
        await apiCall(`/admin/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ===== 管理员：更新用户权限 =====
async function updateUserPermissions(userId, featureKeys) {
    if (!isAdmin()) return { success: false, error: '权限不足' };
    try {
        await apiCall(`/admin/users/${userId}/permissions`, {
            method: 'PUT',
            body: JSON.stringify({ permissions: featureKeys })
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ===== 管理员：获取所有用户 =====
async function getAllUsers() {
    if (!isAdmin()) return { success: false, error: '权限不足' };
    try {
        const data = await apiCall('/admin/users');
        return { success: true, users: data.users || [] };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ===== 管理员：获取用户权限 =====
async function getUserPermissions(userId) {
    if (!isAdmin()) return { success: false, error: '权限不足' };
    try {
        const data = await apiCall(`/admin/users/${userId}/permissions`);
        return { success: true, permissions: data.permissions || [] };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ===== 管理员：审批用户 =====
async function approveUser(userId) {
    if (!isAdmin()) return { success: false, error: '权限不足' };
    try {
        await apiCall(`/admin/users/${userId}/approve`, { method: 'PUT' });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function rejectUser(userId) {
    if (!isAdmin()) return { success: false, error: '权限不足' };
    try {
        await apiCall(`/admin/users/${userId}/reject`, { method: 'PUT' });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ===== 管理员：删除用户 =====
async function deleteUserAccount(userId) {
    if (!isAdmin()) return { success: false, error: '权限不足' };
    try {
        await apiCall(`/admin/users/${userId}`, { method: 'DELETE' });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ===== 管理员：切换用户状态 =====
async function toggleUserStatus(userId) {
    if (!isAdmin()) return { success: false, error: '权限不足' };
    try {
        await apiCall(`/admin/users/${userId}/toggle`, { method: 'PUT' });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ===== 工具函数 =====
function isLoggedIn() {
    return currentUser !== null;
}

function isAdmin() {
    return userProfile && userProfile.role === 'admin';
}

const PAGE_TO_FEATURE = {
    'image': 'image_gen',
    'copy': 'copywriting',
    'datacenter': 'plugin',
    'analysis': 'plugin'
};

function hasPermission(featureKey) {
    if (!isLoggedIn()) return false;
    if (isAdmin()) return true;
    const mapped = PAGE_TO_FEATURE[featureKey] || featureKey;
    return userPermissions.includes(mapped);
}

// ===== 权限控制 =====
function applyPermissions() {
    const navLinks = document.querySelectorAll('.nav-link[data-page]');
    navLinks.forEach(link => {
        const page = link.getAttribute('data-page');
        if (page === 'home') return;
        const hasAccess = hasPermission(page);
        if (!hasAccess) {
            link.classList.add('locked');
            link.style.opacity = '0.5';
            link.style.cursor = 'not-allowed';
            if (!link.querySelector('.lock-icon')) {
                const lockIcon = document.createElement('span');
                lockIcon.className = 'lock-icon';
                lockIcon.textContent = ' 🔒';
                lockIcon.style.fontSize = '12px';
                link.appendChild(lockIcon);
            }
            link.onclick = function(e) { e.preventDefault(); showUpgradePrompt(page); };
        } else {
            link.classList.remove('locked');
            link.style.opacity = '1';
            link.style.cursor = 'pointer';
            const lockIcon = link.querySelector('.lock-icon');
            if (lockIcon) lockIcon.remove();
            link.onclick = function() { showPage(page); };
        }
    });
    updateHomeFeatureCards();
}

function updateHomeFeatureCards() {
    const featureCards = document.querySelectorAll('.home-feature-card');
    featureCards.forEach(card => {
        const page = card.getAttribute('data-page');
        if (!page) return;
        const hasAccess = hasPermission(page);
        if (!hasAccess) {
            card.style.opacity = '0.6';
            card.style.cursor = 'not-allowed';
            if (!card.querySelector('.feature-locked')) {
                const lockedBadge = document.createElement('div');
                lockedBadge.className = 'feature-locked';
                lockedBadge.textContent = '🔒 需要权限';
                lockedBadge.style.cssText = 'position:absolute;top:8px;right:8px;font-size:11px;background:rgba(0,0,0,0.7);color:white;padding:2px 6px;border-radius:4px';
                card.style.position = 'relative';
                card.appendChild(lockedBadge);
            }
            card.onclick = function(e) { e.preventDefault(); showUpgradePrompt(page); };
        } else {
            card.style.opacity = '1';
            card.style.cursor = 'pointer';
            const lockedBadge = card.querySelector('.feature-locked');
            if (lockedBadge) lockedBadge.remove();
            card.onclick = function() { showPage(page); };
        }
    });
}

// ===== UI 更新 =====
function updateAuthUI() {
    const userSection = document.getElementById('userSection');
    if (!userSection) return;

    if (isLoggedIn()) {
        const user = userProfile || currentUser;
        const isAdminUser = isAdmin();
        userSection.innerHTML = `
            <span style="font-size:13px;color:#666">👋 ${user.display_name || user.email}</span>
            ${isAdminUser ? '<button class="admin-btn" onclick="showAdminPanel()">⚙️ 管理</button>' : ''}
            <button onclick="handleLogoutClick()" style="padding:8px 16px;background:transparent;color:#666;border:1px solid #ddd;border-radius:8px;font-size:13px;cursor:pointer">退出</button>
        `;
    } else {
        userSection.innerHTML = `
            <button onclick="showRegisterModal()" style="padding:8px 16px;background:transparent;color:#F4845F;border:1.5px solid #F4845F;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;margin-right:8px;">注册</button>
            <button onclick="showLoginModal()" style="padding:8px 24px;background:#F4845F;color:white;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">登录</button>
        `;
    }
}

// ===== 登录弹窗 =====
function showLoginModal() {
    const existing = document.getElementById('loginModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'loginModal';
    modal.className = 'login-modal';
    modal.innerHTML = `
        <div class="login-modal-content">
            <div class="login-modal-header">
                <h3>🔐 登录</h3>
                <button class="login-modal-close" onclick="document.getElementById('loginModal').remove()">×</button>
            </div>
            <form id="loginForm" onsubmit="handleLoginSubmit(event)">
                <div class="form-group">
                    <label>邮箱</label>
                    <input type="email" id="loginEmail" placeholder="请输入邮箱" required>
                </div>
                <div class="form-group">
                    <label>密码</label>
                    <input type="password" id="loginPassword" placeholder="请输入密码" required>
                </div>
                <div id="loginError" class="login-error"></div>
                <button type="submit" class="login-submit-btn">登录</button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
}

async function handleLoginSubmit(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    const submitBtn = event.target.querySelector('.login-submit-btn');

    errorDiv.textContent = '';
    submitBtn.disabled = true;
    submitBtn.textContent = '登录中...';

    const result = await login(email, password);

    if (result.success) {
        document.getElementById('loginModal').remove();
        await handleLogin(result.user);
    } else {
        errorDiv.textContent = result.error || '登录失败，请检查邮箱和密码';
        submitBtn.disabled = false;
        submitBtn.textContent = '登录';
    }
}

async function handleLogoutClick() {
    if (confirm('确定要退出登录吗？')) {
        await logout();
    }
}

// ===== 注册弹窗 =====
function showRegisterModal() {
    document.getElementById('registerModal').classList.add('show');
}

function closeRegisterModal() {
    document.getElementById('registerModal').classList.remove('show');
    document.getElementById('registerError').textContent = '';
    document.getElementById('regEmail').value = '';
    document.getElementById('regPassword').value = '';
    document.getElementById('regName').value = '';
    document.getElementById('regPosition').value = '';
}

// ===== 升级提示 =====
function showUpgradePrompt(featureKey) {
    if (!isLoggedIn()) {
        showToast('请先登录后再使用此功能', 'warning');
        showLoginModal();
        return;
    }
    showToast('您暂无此功能的使用权限，请联系管理员开通', 'warning');
}

// ===== 管理面板 =====
function showAdminPanel() {
    showPage('admin');
}

// ===== 数据迁移（localStorage → 服务器）=====
async function migrateLocalStorageToSupabase() {
    // 旧逻辑：迁移 localStorage 数据到 Supabase
    // 新逻辑：已不再需要，数据直接存在服务器
    console.log('数据迁移已跳过（使用自建 API）');
}

// ===== 历史记录 API =====
async function saveGenerationHistory(genType, inputParams, outputContent, rating = null, extra = {}) {
    if (!isLoggedIn()) return null;
    try {
        const data = await apiCall('/history', {
            method: 'POST',
            body: JSON.stringify({
                gen_type: genType,
                input_params: inputParams,
                output_content: outputContent,
                rating,
                ...extra
            })
        });
        return data.id;
    } catch (e) {
        console.error('保存历史失败:', e);
        return null;
    }
}

async function updateGenerationRating(historyId, rating) {
    try {
        await apiCall(`/history/${historyId}/rating`, {
            method: 'PUT',
            body: JSON.stringify({ rating })
        });
    } catch (e) {
        console.error('更新评分失败:', e);
    }
}

async function softDeleteHistory(id) {
    try {
        await apiCall(`/history/${id}/soft-delete`, { method: 'PUT' });
        return true;
    } catch (e) {
        console.error('删除历史失败:', e);
        return false;
    }
}

async function getHighRatedExamples(genType, limit = 3) {
    try {
        const data = await apiCall(`/history/high-rated?gen_type=${genType}&limit=${limit}`);
        return data.examples || [];
    } catch (e) {
        console.error('获取高分示例失败:', e);
        return [];
    }
}

async function getGenerationHistoryList(genType = null, limit = 50) {
    try {
        let url = `/history?limit=${limit}`;
        if (genType && genType !== 'all') url += `&gen_type=${genType}`;
        const data = await apiCall(url);
        return data.history || [];
    } catch (e) {
        console.error('获取历史列表失败:', e);
        return [];
    }
}

// ===== 素材库 API =====
async function saveUserAsset(asset) {
    try {
        await apiCall('/assets', {
            method: 'POST',
            body: JSON.stringify(asset)
        });
    } catch (e) {
        console.error('保存素材失败:', e);
    }
}

async function getUserAssets() {
    try {
        const data = await apiCall('/assets');
        return data.assets || [];
    } catch (e) {
        console.error('获取素材失败:', e);
        return [];
    }
}

async function updateUserAssetRating(id, rating) {
    try {
        await apiCall(`/assets/${id}/rating`, {
            method: 'PUT',
            body: JSON.stringify({ rating })
        });
    } catch (e) {
        console.error('更新素材评分失败:', e);
    }
}

async function deleteUserAssets(ids) {
    try {
        await apiCall('/assets/batch', {
            method: 'DELETE',
            body: JSON.stringify({ ids })
        });
    } catch (e) {
        console.error('删除素材失败:', e);
    }
}

// ===== 品牌库 API =====
async function saveUserBrand(brand) {
    try {
        await apiCall('/brands', {
            method: 'POST',
            body: JSON.stringify(brand)
        });
    } catch (e) {
        console.error('保存品牌失败:', e);
    }
}

async function getUserBrands() {
    try {
        const data = await apiCall('/brands');
        return data.brands || [];
    } catch (e) {
        console.error('获取品牌失败:', e);
        return [];
    }
}

async function deleteUserBrand(id) {
    try {
        await apiCall(`/brands/${id}`, { method: 'DELETE' });
    } catch (e) {
        console.error('删除品牌失败:', e);
    }
}

// ===== 模板 API =====
async function saveUserTemplate(template) {
    try {
        await apiCall('/templates', {
            method: 'POST',
            body: JSON.stringify(template)
        });
    } catch (e) {
        console.error('保存模板失败:', e);
    }
}

async function getUserTemplates() {
    try {
        const data = await apiCall('/templates');
        return data.templates || [];
    } catch (e) {
        console.error('获取模板失败:', e);
        return [];
    }
}

async function deleteUserTemplate(id) {
    try {
        await apiCall(`/templates/${id}`, { method: 'DELETE' });
    } catch (e) {
        console.error('删除模板失败:', e);
    }
}

// ===== 偏好 API =====
async function savePreference(key, value) {
    try {
        await apiCall('/preferences', {
            method: 'POST',
            body: JSON.stringify({ pref_key: key, pref_value: value })
        });
    } catch (e) {
        console.error('保存偏好失败:', e);
    }
}

async function getUserPreferences() {
    try {
        const data = await apiCall('/preferences');
        return data.preferences || [];
    } catch (e) {
        console.error('获取偏好失败:', e);
        return [];
    }
}

// ===== 反馈 API =====
async function saveFeedback(feedback) {
    try {
        await apiCall('/feedback', {
            method: 'POST',
            body: JSON.stringify(feedback)
        });
    } catch (e) {
        console.error('保存反馈失败:', e);
    }
}

async function getFeedbackList() {
    try {
        const data = await apiCall('/feedback');
        return data.feedback || [];
    } catch (e) {
        console.error('获取反馈失败:', e);
        return [];
    }
}

// ===== 插件反馈 API =====
async function submitPluginFeedback(feedback) {
    try {
        await apiCall('/plugin-feedback', {
            method: 'POST',
            body: JSON.stringify(feedback)
        });
    } catch (e) {
        console.error('提交反馈失败:', e);
    }
}

async function updateFeedbackStatus(id, status) {
    try {
        await apiCall(`/plugin-feedback/${id}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
    } catch (e) {
        console.error('更新反馈状态失败:', e);
    }
}

async function deleteFeedback(id) {
    try {
        await apiCall(`/plugin-feedback/${id}`, { method: 'DELETE' });
    } catch (e) {
        console.error('删除反馈失败:', e);
    }
}

// ===== 管理员日志 =====
async function logAdminAction(action, target = '', details = '') {
    try {
        await apiCall('/admin/log', {
            method: 'POST',
            body: JSON.stringify({ action, target, details })
        });
    } catch (e) { /* 静默 */ }
}

// ===== 页面权限检查 =====
function checkPagePermission(page) {
    if (page === 'home') return true;
    if (!isLoggedIn()) {
        showLoginModal();
        return false;
    }
    if (!hasPermission(page)) {
        showUpgradePrompt(page);
        return false;
    }
    return true;
}

// 向后兼容别名
const initSupabase = initAuth;

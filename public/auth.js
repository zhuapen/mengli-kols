/**
 * 萌力互动 · 权限管理系统
 * 方案B：按功能模块单独勾选
 * 基于 Supabase Auth 的用户认证和权限控制
 */

// Supabase 配置
const SUPABASE_URL = 'https://fjlxlkokmcdfmwskgvsp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqbHhsa29rbWNkZm13c2tndnNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NTQ4OTMsImV4cCI6MjA5NjAzMDg5M30.LcFIuu1dmiU09IptN3vYKE0NkDighHnOkbepHbubfaU';

// 初始化 Supabase 客户端
let supabase = null;
let currentUser = null;
let userProfile = null;
let userPermissions = [];
let allFeatures = [];

// 预设岗位列表
const PRESET_POSITIONS = [
    'AE（客户执行）',
    'AM（客户经理）',
    '策划',
    '媒介',
    '设计师',
    '文案',
    '视频剪辑',
    '总监',
    '主管',
    '实习生',
    '运营'
];

/**
 * 初始化 Supabase
 */
async function initSupabase() {
    try {
        // 动态加载 Supabase SDK（本地文件优先，CDN 备用）
        if (typeof window.supabase === 'undefined') {
            try {
                await loadScript('supabase.min.js');
                console.log('从本地加载 Supabase SDK 成功');
            } catch (e) {
                console.warn('本地 SDK 加载失败，尝试 CDN...');
                try {
                    await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js');
                } catch (e2) {
                    console.error('所有 CDN 均加载失败');
                }
            }
        }

        if (typeof window.supabase === 'undefined') {
            console.error('Supabase SDK 加载失败，window.supabase 未定义');
            return false;
        }

        console.log('Supabase SDK 已加载，开始初始化客户端...');
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // 监听登录状态变化
        supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth state changed:', event);
            if (event === 'SIGNED_IN' && session) {
                handleLogin(session.user);
            } else if (event === 'SIGNED_OUT') {
                handleLogout();
            }
        });

        // 检查当前登录状态
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            await handleLogin(session.user);
        }

        // 加载所有功能配置
        await loadAllFeatures();

        console.log('Supabase 初始化完成');
        return true;
    } catch (error) {
        console.error('Supabase 初始化失败:', error);
        return false;
    }
}

/**
 * 动态加载脚本
 */
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

/**
 * 加载所有功能配置
 */
async function loadAllFeatures() {
    try {
        const { data, error } = await supabase
            .from('feature_permissions')
            .select('*')
            .order('id');

        if (error) throw error;
        allFeatures = data || [];
    } catch (error) {
        console.error('加载功能配置失败:', error);
        // 使用默认配置
        allFeatures = [
            { feature_key: 'find', feature_name: '找号' },
            { feature_key: 'image_gen', feature_name: '图片生成' },
            { feature_key: 'copywriting', feature_name: '文案撰写' },
            { feature_key: 'article', feature_name: '推文生成' },
            { feature_key: 'assets', feature_name: '素材库' },
            { feature_key: 'knowledge', feature_name: '知识库' }
        ];
    }
}

/**
 * 加载用户的功能权限
 */
async function loadUserPermissions() {
    if (!currentUser) return;

    try {
        const { data, error } = await supabase
            .from('user_feature_permissions')
            .select('feature_key')
            .eq('user_id', currentUser.id);

        if (error) throw error;
        userPermissions = data ? data.map(p => p.feature_key) : [];
    } catch (error) {
        console.error('加载用户权限失败:', error);
        userPermissions = [];
    }
}

/**
 * 处理用户登录
 */
let _sessionCheckTimer = null;

async function handleLogin(user) {
    currentUser = user;
    console.log('用户已登录:', user.email);

    // 获取用户配置
    await loadUserProfile();

    // 单设备登录：生成 token 并检查是否被踢
    await initSessionToken(user.id);

    // 加载用户权限
    await loadUserPermissions();

    // 更新 UI
    updateAuthUI();

    // 应用权限控制
    applyPermissions();

    // 登录后自动迁移 localStorage 数据到 Supabase
    migrateLocalStorageToSupabase();
}

async function initSessionToken(userId) {
    try {
        // 读取 DB 中的 token
        const { data } = await supabase
            .from('user_profiles')
            .select('session_token')
            .eq('id', userId)
            .single();

        const localToken = localStorage.getItem('session_token');
        const dbToken = data?.session_token || '';

        // 如果 DB 有 token 且和本地不一致 → 被其他人登录了
        if (dbToken && localToken && dbToken !== localToken) {
            // 不需要提示，直接让对方接管（我们生成新 token）
        }

        // 生成新 token 并写入 DB + localStorage
        const newToken = crypto.randomUUID();
        localStorage.setItem('session_token', newToken);
        await supabase.from('user_profiles').update({ session_token: newToken }).eq('id', userId);

        // 启动定时检查（每 30 秒）
        startSessionCheck(userId, newToken);
    } catch(e) {
        console.warn('Session token 初始化失败:', e);
    }
}

function startSessionCheck(userId, myToken) {
    if (_sessionCheckTimer) clearInterval(_sessionCheckTimer);
    _sessionCheckTimer = setInterval(async () => {
        if (!currentUser) { clearInterval(_sessionCheckTimer); return; }
        try {
            const { data } = await supabase
                .from('user_profiles')
                .select('session_token')
                .eq('id', userId)
                .single();
            if (data && data.session_token && data.session_token !== myToken) {
                // 被其他设备踢出
                clearInterval(_sessionCheckTimer);
                localStorage.removeItem('session_token');
                showToast('您的账号已在其他设备登录，当前会话已退出');
                await logout();
            }
        } catch(e) { /* 静默失败 */ }
    }, 30000);
}

/**
 * 处理用户登出
 */
function handleLogout() {
    if (_sessionCheckTimer) { clearInterval(_sessionCheckTimer); _sessionCheckTimer = null; }
    currentUser = null;
    userProfile = null;
    userPermissions = [];
    console.log('用户已登出');

    // 更新 UI
    updateAuthUI();

    // 跳转到首页
    showPage('home');
}

/**
 * 加载用户配置
 */
async function loadUserProfile() {
    if (!currentUser) return;

    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (error) throw error;
        userProfile = data;
        console.log('用户配置:', userProfile);
    } catch (error) {
        console.error('加载用户配置失败:', error);
        // 如果没有配置，创建一个默认的
        userProfile = {
            id: currentUser.id,
            email: currentUser.email,
            display_name: currentUser.email.split('@')[0],
            role: 'user',
            position: '未设置',
            is_active: true
        };
    }
}

/**
 * 用户登录
 */
async function login(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;
        return { success: true, user: data.user };
    } catch (error) {
        console.error('登录失败:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 用户登出
 */
async function logout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('登出失败:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 管理员创建用户（仅管理员可用）
 */
async function createUser(email, password, displayName, position) {
    if (!isAdmin()) {
        return { success: false, error: '权限不足：只有管理员可以创建用户' };
    }

    try {
        // 通过后端 API 调用 Supabase Admin API（service_role key 不暴露到前端）
        const resp = await fetch('/api', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'create_user',
                email: email,
                password: password,
                display_name: displayName,
                position: position
            })
        });
        const result = await resp.json();

        if (result.error) {
            return { success: false, error: result.error };
        }

        return { success: true, user: { id: result.user_id } };
    } catch (error) {
        console.error('创建用户失败:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 管理员更新用户信息
 */
async function updateUserProfile(userId, updates) {
    if (!isAdmin()) {
        return { success: false, error: '权限不足：只有管理员可以修改用户信息' };
    }

    try {
        const { error } = await supabase
            .from('user_profiles')
            .update(updates)
            .eq('id', userId);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('更新用户信息失败:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 管理员更新用户功能权限
 */
async function updateUserPermissions(userId, featureKeys) {
    if (!isAdmin()) {
        return { success: false, error: '权限不足：只有管理员可以修改权限' };
    }

    try {
        // 先删除所有权限
        const { error: deleteError } = await supabase
            .from('user_feature_permissions')
            .delete()
            .eq('user_id', userId);

        if (deleteError) throw deleteError;

        // 再插入新权限
        if (featureKeys.length > 0) {
            const permissions = featureKeys.map(key => ({
                user_id: userId,
                feature_key: key
            }));

            const { error: insertError } = await supabase
                .from('user_feature_permissions')
                .insert(permissions);

            if (insertError) throw insertError;
        }

        return { success: true };
    } catch (error) {
        console.error('更新用户权限失败:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 获取所有用户（仅管理员）
 */
async function getAllUsers() {
    if (!isAdmin()) {
        return { success: false, error: '权限不足' };
    }

    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return { success: true, users: data };
    } catch (error) {
        console.error('获取用户列表失败:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 获取用户的功能权限（仅管理员）
 */
async function getUserPermissions(userId) {
    if (!isAdmin()) {
        return { success: false, error: '权限不足' };
    }

    try {
        const { data, error } = await supabase
            .from('user_feature_permissions')
            .select('feature_key')
            .eq('user_id', userId);

        if (error) throw error;
        return { success: true, permissions: data ? data.map(p => p.feature_key) : [] };
    } catch (error) {
        console.error('获取用户权限失败:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 检查是否已登录
 */
function isLoggedIn() {
    return currentUser !== null;
}

/**
 * 检查是否是管理员
 */
function isAdmin() {
    return userProfile && userProfile.role === 'admin';
}

/**
 * 检查是否有某个功能的权限
 */
// 页面名 → 数据库 feature_key 映射（data-page 值和 feature_key 不一致时用）
const PAGE_TO_FEATURE = {
    'image': 'image_gen',
    'copy': 'copywriting'
};

function hasPermission(featureKey) {
    if (!isLoggedIn()) return false;
    if (isAdmin()) return true;
    const mapped = PAGE_TO_FEATURE[featureKey] || featureKey;
    return userPermissions.includes(mapped);
}

/**
 * 应用权限控制到页面
 */
function applyPermissions() {
    // 获取所有导航链接
    const navLinks = document.querySelectorAll('.nav-link[data-page]');

    navLinks.forEach(link => {
        const page = link.getAttribute('data-page');
        // 首页始终允许访问
        if (page === 'home') return;

        const hasAccess = hasPermission(page);

        if (!hasAccess) {
            // 添加锁定样式
            link.classList.add('locked');
            link.style.opacity = '0.5';
            link.style.cursor = 'not-allowed';

            // 添加锁定图标
            if (!link.querySelector('.lock-icon')) {
                const lockIcon = document.createElement('span');
                lockIcon.className = 'lock-icon';
                lockIcon.textContent = ' 🔒';
                lockIcon.style.fontSize = '12px';
                link.appendChild(lockIcon);
            }

            // 修改点击事件
            link.onclick = function(e) {
                e.preventDefault();
                showUpgradePrompt(page);
            };
        } else {
            // 移除锁定样式
            link.classList.remove('locked');
            link.style.opacity = '1';
            link.style.cursor = 'pointer';

            // 移除锁定图标
            const lockIcon = link.querySelector('.lock-icon');
            if (lockIcon) lockIcon.remove();

            // 恢复原始点击事件
            link.onclick = function() {
                showPage(page);
            };
        }
    });

    // 更新首页功能卡片
    updateHomeFeatureCards();
}

/**
 * 更新首页功能卡片的权限显示
 */
function updateHomeFeatureCards() {
    const featureCards = document.querySelectorAll('.home-feature-card');

    featureCards.forEach(card => {
        const page = card.getAttribute('data-page');
        if (!page) return;

        const hasAccess = hasPermission(page);

        if (!hasAccess) {
            card.style.opacity = '0.6';
            card.style.cursor = 'not-allowed';

            // 添加锁定标记
            if (!card.querySelector('.feature-locked')) {
                const lockedBadge = document.createElement('div');
                lockedBadge.className = 'feature-locked';
                lockedBadge.textContent = '请联系管理员开通';
                card.style.position = 'relative';
                card.appendChild(lockedBadge);
            }

            card.onclick = function(e) {
                e.preventDefault();
                showUpgradePrompt(page);
            };
        }
    });
}

/**
 * 显示升级提示
 */
function showUpgradePrompt(featureKey) {
    const feature = allFeatures.find(f => f.feature_key === featureKey);
    const featureName = feature ? feature.feature_name : featureKey;

    const modal = document.createElement('div');
    modal.className = 'upgrade-modal';
    modal.innerHTML = `
        <div class="upgrade-modal-content">
            <div class="upgrade-modal-header">
                <h3>🔒 功能受限</h3>
                <button class="upgrade-modal-close" onclick="this.closest('.upgrade-modal').remove()">×</button>
            </div>
            <div class="upgrade-modal-body">
                <p><strong>${featureName}</strong> 功能暂未开通</p>
                <p class="upgrade-hint">请联系管理员开通此功能</p>
            </div>
            <div class="upgrade-modal-footer">
                <button class="upgrade-modal-btn" onclick="this.closest('.upgrade-modal').remove()">我知道了</button>
            </div>
        </div>
    `;

    // 添加样式
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.3s ease;
    `;

    const style = document.createElement('style');
    style.textContent = `
        .upgrade-modal-content {
            background: white;
            border-radius: 16px;
            padding: 24px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .upgrade-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
        }
        .upgrade-modal-header h3 {
            margin: 0;
            font-size: 20px;
        }
        .upgrade-modal-close {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #666;
        }
        .upgrade-modal-body {
            margin-bottom: 20px;
            line-height: 1.8;
        }
        .upgrade-hint {
            color: #666;
            font-size: 14px;
            margin-top: 12px;
        }
        .upgrade-modal-btn {
            width: 100%;
            padding: 12px;
            background: var(--accent, #F4845F);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            transition: background 0.3s;
        }
        .upgrade-modal-btn:hover {
            background: var(--accent-light, #F7A072);
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
    `;

    document.head.appendChild(style);
    document.body.appendChild(modal);
}

/**
 * 更新认证相关的 UI
 */
function updateAuthUI() {
    // 查找或创建用户信息区域
    let userSection = document.getElementById('userSection');

    if (!userSection) {
        // 在导航栏末尾创建用户区域
        const nav = document.querySelector('nav.nav');
        if (!nav) return;

        userSection = document.createElement('div');
        userSection.id = 'userSection';
        userSection.className = 'user-section';
        nav.appendChild(userSection);
    }

    // 确保 user-section 样式正确
    userSection.style.marginLeft = 'auto';

    if (isLoggedIn && isLoggedIn()) {
        const displayName = userProfile?.display_name || currentUser.email.split('@')[0];
        const position = userProfile?.position || '未设置岗位';

        userSection.innerHTML = `
            <div class="user-info">
                <div class="user-avatar">${displayName.charAt(0).toUpperCase()}</div>
                <div class="user-details">
                    <div class="user-name">欢迎回来，${displayName}</div>
                    <div class="user-position">岗位：${position}</div>
                </div>
                ${isAdmin() ? '<button class="admin-btn" onclick="showAdminPanel()">⚙️ 管理</button>' : ''}
                <button class="logout-btn" onclick="handleLogoutClick()">退出</button>
            </div>
        `;

        // 添加样式
        if (!document.getElementById('userSectionStyles')) {
            const style = document.createElement('style');
            style.id = 'userSectionStyles';
            style.textContent = `
                .user-section {
                    margin-left: auto;
                    padding: 0 20px;
                }
                .user-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .user-avatar {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    background: var(--accent, #F4845F);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    font-size: 16px;
                }
                .user-details {
                    display: flex;
                    flex-direction: column;
                }
                .user-name {
                    font-weight: 600;
                    font-size: 14px;
                }
                .user-position {
                    font-size: 12px;
                    color: #6B7280;
                }
                .admin-btn, .logout-btn {
                    padding: 6px 12px;
                    border: none;
                    border-radius: 6px;
                    font-size: 13px;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                .admin-btn {
                    background: #3B82F6;
                    color: white;
                }
                .admin-btn:hover {
                    background: #2563EB;
                }
                .logout-btn {
                    background: #F3F4F6;
                    color: #374151;
                }
                .logout-btn:hover {
                    background: #E5E7EB;
                }
            `;
            document.head.appendChild(style);
        }
    } else {
        userSection.innerHTML = `
            <div class="user-info">
                <button class="login-btn" onclick="showLoginModal()">登录</button>
            </div>
        `;

        // 添加登录按钮样式
        if (!document.getElementById('loginBtnStyles')) {
            const style = document.createElement('style');
            style.id = 'loginBtnStyles';
            style.textContent = `
                .login-btn {
                    padding: 8px 20px;
                    background: var(--accent, #F4845F);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                .login-btn:hover {
                    background: var(--accent-light, #F7A072);
                    transform: translateY(-2px);
                }
            `;
            document.head.appendChild(style);
        }
    }
}

/**
 * 显示登录弹窗
 */
function showLoginModal() {
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

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
        .login-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease;
        }
        .login-modal-content {
            background: white;
            border-radius: 16px;
            padding: 32px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .login-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
        }
        .login-modal-header h3 {
            margin: 0;
            font-size: 24px;
        }
        .login-modal-close {
            background: none;
            border: none;
            font-size: 28px;
            cursor: pointer;
            color: #666;
        }
        .form-group {
            margin-bottom: 20px;
        }
        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #374151;
        }
        .form-group input {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #E5E7EB;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.3s;
            box-sizing: border-box;
        }
        .form-group input:focus {
            outline: none;
            border-color: var(--accent, #F4845F);
        }
        .login-error {
            color: #EF4444;
            font-size: 14px;
            margin-bottom: 16px;
            min-height: 20px;
        }
        .login-submit-btn {
            width: 100%;
            padding: 14px;
            background: var(--accent, #F4845F);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
        }
        .login-submit-btn:hover {
            background: var(--accent-light, #F7A072);
        }
        .login-submit-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
    `;

    document.head.appendChild(style);
    document.body.appendChild(modal);
}

/**
 * 处理登录提交
 */
async function handleLoginSubmit(event) {
    event.preventDefault();

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    const submitBtn = event.target.querySelector('.login-submit-btn');

    // 清除错误信息
    errorDiv.textContent = '';
    submitBtn.disabled = true;
    submitBtn.textContent = '登录中...';

    const result = await login(email, password);

    if (result.success) {
        // 登录成功，关闭弹窗
        document.getElementById('loginModal').remove();
    } else {
        // 显示错误信息
        errorDiv.textContent = result.error || '登录失败，请检查邮箱和密码';
        submitBtn.disabled = false;
        submitBtn.textContent = '登录';
    }
}

/**
 * 处理登出点击
 */
async function handleLogoutClick() {
    if (confirm('确定要退出登录吗？')) {
        await logout();
    }
}

/**
 * 显示管理员面板
 */
function showAdminPanel() {
    if (!isAdmin()) {
        alert('权限不足');
        return;
    }

    // 创建管理员面板
    const modal = document.createElement('div');
    modal.id = 'adminModal';
    modal.className = 'admin-modal';
    modal.innerHTML = `
        <div class="admin-modal-content">
            <div class="admin-modal-header">
                <h3>⚙️ 管理员面板</h3>
                <button class="admin-modal-close" onclick="document.getElementById('adminModal').remove()">×</button>
            </div>
            <div class="admin-tabs">
                <button class="admin-tab active" onclick="switchAdminTab('users', this)">用户管理</button>
                <button class="admin-tab" onclick="switchAdminTab('create', this)">创建用户</button>
                <button class="admin-tab" onclick="switchAdminTab('plugins', this)">插件管理</button>
                <button class="admin-tab" onclick="switchAdminTab('feedback', this)">反馈管理</button>
            </div>
            <div id="adminTabContent" class="admin-tab-content">
                <div class="loading">加载中...</div>
            </div>
        </div>
    `;

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
        .admin-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease;
        }
        .admin-modal-content {
            background: white;
            border-radius: 16px;
            padding: 0;
            max-width: 800px;
            width: 95%;
            max-height: 85vh;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            display: flex;
            flex-direction: column;
        }
        .admin-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 24px;
            border-bottom: 1px solid #E5E7EB;
        }
        .admin-modal-header h3 {
            margin: 0;
            font-size: 22px;
        }
        .admin-modal-close {
            background: none;
            border: none;
            font-size: 28px;
            cursor: pointer;
            color: #666;
        }
        .admin-tabs {
            display: flex;
            border-bottom: 1px solid #E5E7EB;
            padding: 0 24px;
        }
        .admin-tab {
            padding: 12px 20px;
            background: none;
            border: none;
            font-size: 15px;
            cursor: pointer;
            color: #6B7280;
            border-bottom: 3px solid transparent;
            transition: all 0.3s;
        }
        .admin-tab.active {
            color: var(--accent, #F4845F);
            border-bottom-color: var(--accent, #F4845F);
        }
        .admin-tab-content {
            padding: 24px;
            overflow-y: auto;
            flex: 1;
        }
        .user-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .user-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px;
            background: #F9FAFB;
            border-radius: 10px;
            transition: all 0.3s;
        }
        .user-item:hover {
            background: #F3F4F6;
        }
        .user-item-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .user-item-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: var(--accent, #F4845F);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
        }
        .user-item-details {
            display: flex;
            flex-direction: column;
        }
        .user-item-name {
            font-weight: 600;
        }
        .user-item-email {
            font-size: 13px;
            color: #6B7280;
        }
        .user-item-position {
            font-size: 12px;
            color: #3B82F6;
            background: #EFF6FF;
            padding: 2px 8px;
            border-radius: 4px;
            margin-top: 4px;
            display: inline-block;
        }
        .user-item-actions {
            display: flex;
            gap: 8px;
            align-items: center;
        }
        .permissions-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            margin-top: 12px;
        }
        .permission-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: #F3F4F6;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .permission-item:hover {
            background: #E5E7EB;
        }
        .permission-item.enabled {
            background: #D1FAE5;
            border: 1px solid #34D399;
        }
        .permission-item input[type="checkbox"] {
            margin: 0;
        }
        .create-user-form {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        .create-user-form input,
        .create-user-form select {
            padding: 12px 16px;
            border: 2px solid #E5E7EB;
            border-radius: 8px;
            font-size: 15px;
        }
        .create-user-form input:focus,
        .create-user-form select:focus {
            outline: none;
            border-color: var(--accent, #F4845F);
        }
        .create-user-btn {
            padding: 14px;
            background: var(--accent, #F4845F);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
        }
        .create-user-btn:hover {
            background: var(--accent-light, #F7A072);
        }
        .create-user-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        .create-result {
            padding: 12px;
            border-radius: 8px;
            font-size: 14px;
            margin-top: 12px;
        }
        .create-result.success {
            background: #D1FAE5;
            color: #065F46;
        }
        .create-result.error {
            background: #FEE2E2;
            color: #991B1B;
        }
        .loading {
            text-align: center;
            color: #6B7280;
            padding: 40px;
        }
        .save-permissions-btn {
            padding: 8px 16px;
            background: #10B981;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.3s;
        }
        .save-permissions-btn:hover {
            background: #059669;
        }
        .edit-user-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
        }
        .edit-user-content {
            background: white;
            border-radius: 16px;
            padding: 24px;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        }
    `;

    document.head.appendChild(style);
    document.body.appendChild(modal);

    // 加载用户列表
    loadUsersList();
}

/**
 * 切换管理员面板标签
 */
function switchAdminTab(tab, btn) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');

    if (tab === 'users') {
        loadUsersList();
    } else if (tab === 'create') {
        showCreateUserForm();
    } else if (tab === 'plugins') {
        showPluginManagement();
    } else if (tab === 'feedback') {
        showFeedbackManagement();
    }
}

/**
 * 加载用户列表
 */
async function loadUsersList() {
    const content = document.getElementById('adminTabContent');
    content.innerHTML = '<div class="loading">加载中...</div>';

    const result = await getAllUsers();

    if (!result.success) {
        content.innerHTML = `<div class="loading">加载失败: ${result.error}</div>`;
        return;
    }

    const users = result.users;

    if (users.length === 0) {
        content.innerHTML = '<div class="loading">暂无用户</div>';
        return;
    }

    content.innerHTML = `
        <div class="user-list">
            ${users.map(user => `
                <div class="user-item">
                    <div class="user-item-info">
                        <div class="user-item-avatar">${(user.display_name || user.email).charAt(0).toUpperCase()}</div>
                        <div class="user-item-details">
                            <div class="user-item-name">${user.display_name || '未设置'}</div>
                            <div class="user-item-email">${user.email}</div>
                            <div class="user-item-position">${user.position || '未设置岗位'}</div>
                        </div>
                    </div>
                    <div class="user-item-actions">
                        ${user.role === 'admin'
                            ? '<span style="color: #3B82F6; font-weight: 600;">管理员</span>'
                            : `<button class="save-permissions-btn" onclick="showEditUserModal('${user.id}', '${user.display_name}', '${user.position || ''}')">编辑权限</button>
                               <button onclick="deleteUserAccount('${user.id}', '${(user.display_name||user.email).replace(/'/g,"\\'")}')" style="padding:6px 12px;border:1px solid #FCA5A5;background:#FEE2E2;color:#DC2626;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600">删除</button>`
                        }
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * 显示编辑用户弹窗
 */
async function showEditUserModal(userId, userName, currentPosition) {
    // 获取用户当前权限
    const permissionsResult = await getUserPermissions(userId);
    const currentPermissions = permissionsResult.success ? permissionsResult.permissions : [];

    const modal = document.createElement('div');
    modal.className = 'edit-user-modal';
    modal.innerHTML = `
        <div class="edit-user-content">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0;">编辑用户：${userName}</h3>
                <button onclick="this.closest('.edit-user-modal').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer;">×</button>
            </div>

            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">岗位名称</label>
                <div style="display: flex; gap: 8px;">
                    <select id="editPosition" style="flex: 1; padding: 10px; border: 2px solid #E5E7EB; border-radius: 6px;">
                        ${PRESET_POSITIONS.map(pos =>
                            `<option value="${pos}" ${pos === currentPosition ? 'selected' : ''}>${pos}</option>`
                        ).join('')}
                        <option value="custom" ${!PRESET_POSITIONS.includes(currentPosition) ? 'selected' : ''}>自定义</option>
                    </select>
                    <input type="text" id="editCustomPosition" placeholder="自定义岗位"
                        value="${!PRESET_POSITIONS.includes(currentPosition) ? currentPosition : ''}"
                        style="flex: 1; padding: 10px; border: 2px solid #E5E7EB; border-radius: 6px; ${PRESET_POSITIONS.includes(currentPosition) ? 'display: none;' : ''}">
                </div>
            </div>

            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">功能权限</label>
                <div class="permissions-grid">
                    ${allFeatures.map(feature => `
                        <label class="permission-item ${currentPermissions.includes(feature.feature_key) ? 'enabled' : ''}">
                            <input type="checkbox" value="${feature.feature_key}"
                                ${currentPermissions.includes(feature.feature_key) ? 'checked' : ''}
                                onchange="this.parentElement.classList.toggle('enabled', this.checked)">
                            ${feature.feature_name}
                        </label>
                    `).join('')}
                </div>
            </div>

            <div id="editUserResult"></div>

            <div style="display: flex; gap: 12px; margin-top: 20px;">
                <button onclick="saveUserEdit('${userId}')" class="save-permissions-btn" style="flex: 1; padding: 12px;">保存</button>
                <button onclick="this.closest('.edit-user-modal').remove()" style="flex: 1; padding: 12px; background: #F3F4F6; border: none; border-radius: 6px; cursor: pointer;">取消</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // 监听岗位选择变化
    document.getElementById('editPosition').addEventListener('change', function() {
        const customInput = document.getElementById('editCustomPosition');
        customInput.style.display = this.value === 'custom' ? 'block' : 'none';
    });
}

/**
 * 保存用户编辑
 */
async function saveUserEdit(userId) {
    const positionSelect = document.getElementById('editPosition');
    const customPosition = document.getElementById('editCustomPosition');
    const resultDiv = document.getElementById('editUserResult');

    // 获取岗位名称
    let position = positionSelect.value;
    if (position === 'custom') {
        position = customPosition.value.trim();
        if (!position) {
            resultDiv.innerHTML = '<div class="create-result error">请输入自定义岗位名称</div>';
            return;
        }
    }

    // 获取选中的权限
    const checkboxes = document.querySelectorAll('.permission-item input[type="checkbox"]:checked');
    const permissions = Array.from(checkboxes).map(cb => cb.value);

    // 保存岗位
    const profileResult = await updateUserProfile(userId, { position });
    if (!profileResult.success) {
        resultDiv.innerHTML = `<div class="create-result error">保存岗位失败: ${profileResult.error}</div>`;
        return;
    }

    // 保存权限
    const permissionsResult = await updateUserPermissions(userId, permissions);
    if (!permissionsResult.success) {
        resultDiv.innerHTML = `<div class="create-result error">保存权限失败: ${permissionsResult.error}</div>`;
        return;
    }

    resultDiv.innerHTML = '<div class="create-result success">保存成功！</div>';

    // 1秒后关闭弹窗并刷新列表
    setTimeout(() => {
        document.querySelector('.edit-user-modal').remove();
        loadUsersList();
    }, 1000);
}

/**
 * 显示创建用户表单
 */
function showCreateUserForm() {
    const content = document.getElementById('adminTabContent');

    content.innerHTML = `
        <form class="create-user-form" onsubmit="handleCreateUser(event)">
            <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">邮箱</label>
                <input type="email" id="newUserEmail" placeholder="user@example.com" required>
            </div>
            <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">密码</label>
                <input type="password" id="newUserPassword" placeholder="至少6位" required minlength="6">
            </div>
            <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">姓名</label>
                <input type="text" id="newUserName" placeholder="员工姓名" required>
            </div>
            <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">岗位</label>
                <div style="display: flex; gap: 8px;">
                    <select id="newUserPosition" style="flex: 1; padding: 12px; border: 2px solid #E5E7EB; border-radius: 8px;" onchange="document.getElementById('newCustomPosition').style.display = this.value === 'custom' ? 'block' : 'none'">
                        ${PRESET_POSITIONS.map(pos => `<option value="${pos}">${pos}</option>`).join('')}
                        <option value="custom">自定义</option>
                    </select>
                    <input type="text" id="newCustomPosition" placeholder="自定义岗位名称" style="flex: 1; padding: 12px; border: 2px solid #E5E7EB; border-radius: 8px; display: none;">
                </div>
            </div>
            <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 600;">功能权限</label>
                <div class="permissions-grid" id="newUserPermissions">
                    ${allFeatures.map(feature => `
                        <label class="permission-item">
                            <input type="checkbox" value="${feature.feature_key}">
                            ${feature.feature_name}
                        </label>
                    `).join('')}
                </div>
            </div>
            <button type="submit" class="create-user-btn" id="createUserBtn">创建用户</button>
            <div id="createResult"></div>
        </form>
    `;
}

/**
 * 处理创建用户
 */
async function handleCreateUser(event) {
    event.preventDefault();

    const email = document.getElementById('newUserEmail').value;
    const password = document.getElementById('newUserPassword').value;
    const name = document.getElementById('newUserName').value;
    const positionSelect = document.getElementById('newUserPosition');
    const customPosition = document.getElementById('newCustomPosition');
    const btn = document.getElementById('createUserBtn');
    const resultDiv = document.getElementById('createResult');

    // 获取岗位
    let position = positionSelect.value;
    if (position === 'custom') {
        position = customPosition.value.trim();
        if (!position) {
            resultDiv.className = 'create-result error';
            resultDiv.textContent = '请输入自定义岗位名称';
            return;
        }
    }

    // 获取选中的权限
    const checkboxes = document.querySelectorAll('#newUserPermissions input[type="checkbox"]:checked');
    const permissions = Array.from(checkboxes).map(cb => cb.value);

    btn.disabled = true;
    btn.textContent = '创建中...';
    resultDiv.innerHTML = '';

    const result = await createUser(email, password, name, position);

    if (result.success) {
        // 设置权限
        if (permissions.length > 0) {
            await updateUserPermissions(result.user.id, permissions);
        }

        resultDiv.className = 'create-result success';
        resultDiv.innerHTML = `✅ 用户创建成功！<br>邮箱: ${email}<br>岗位: ${position}<br>已开通 ${permissions.length} 个功能`;

        // 清空表单
        document.getElementById('newUserEmail').value = '';
        document.getElementById('newUserPassword').value = '';
        document.getElementById('newUserName').value = '';
        document.querySelectorAll('#newUserPermissions input[type="checkbox"]').forEach(cb => cb.checked = false);
    } else {
        resultDiv.className = 'create-result error';
        resultDiv.textContent = `❌ 创建失败: ${result.error}`;
    }

    btn.disabled = false;
    btn.textContent = '创建用户';
}

// ========== DELETE USER (Admin) ==========
async function deleteUserAccount(userId, userName) {
    if (!confirm(`确定删除用户「${userName}」？\n\n此操作不可恢复，该用户的所有数据将被清除。`)) return;

    try {
        const resp = await fetch('/api', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete_user', user_id: userId })
        });
        const result = await resp.json();

        if (result.error) {
            alert('删除失败：' + result.error);
            return;
        }

        showToast('✅ 用户已删除');
        loadUsersList();
    } catch(e) {
        alert('删除失败：' + e.message);
    }
}

// ========== PLUGIN MANAGEMENT (Admin) ==========
async function showPluginManagement() {
    const content = document.getElementById('adminTabContent');
    content.innerHTML = '<div style="text-align:center;padding:20px">加载中...</div>';

    try {
        const { data: plugins, error } = await supabase
            .from('plugins')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;

        content.innerHTML = `
            <div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
                <h4 style="margin:0">插件列表 (${plugins.length})</h4>
                <button onclick="showPluginForm()" style="padding:8px 16px;background:var(--accent);color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600">+ 新增插件</button>
            </div>
            <div id="pluginFormArea"></div>
            <div id="pluginListArea">
                ${plugins.length ? plugins.map(p => `
                    <div style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid #eee;border-radius:8px;margin-bottom:8px">
                        <span style="font-size:24px">${p.icon || '🔌'}</span>
                        <div style="flex:1;min-width:0">
                            <div style="font-weight:600;font-size:14px">${p.name}</div>
                            <div style="font-size:12px;color:#999">${p.version} · 下载 ${p.downloads || 0} 次</div>
                        </div>
                        <button onclick="showPluginForm('${p.id}')" style="padding:6px 12px;border:1px solid #ddd;background:#fff;border-radius:4px;cursor:pointer;font-size:12px">编辑</button>
                        <button onclick="showPluginChangelog('${p.id}','${p.name.replace(/'/g,"\\'")}')" style="padding:6px 12px;border:1px solid #ddd;background:#fff;border-radius:4px;cursor:pointer;font-size:12px">日志</button>
                        <button onclick="deletePlugin('${p.id}')" style="padding:6px 12px;border:1px solid #FCA5A5;background:#FEE2E2;color:#DC2626;border-radius:4px;cursor:pointer;font-size:12px">删除</button>
                    </div>
                `).join('') : '<p style="color:#999;text-align:center;padding:20px">暂无插件</p>'}
            </div>`;
    } catch(e) {
        content.innerHTML = `<p style="color:red">加载失败：${e.message}</p>`;
    }
}

async function showPluginForm(id) {
    const area = document.getElementById('pluginFormArea');
    let plugin = { name:'', icon:'🔌', version:'v1.0.0', short_desc:'', description:'', platforms:'', install_guide:'', known_issues:'', download_url:'' };

    if (id) {
        try {
            const { data } = await supabase.from('plugins').select('*').eq('id', id).single();
            if (data) plugin = data;
        } catch(e){}
    }

    const hasFile = plugin.download_url && plugin.download_url.includes('supabase');

    area.innerHTML = `
        <div style="border:2px solid var(--accent);border-radius:8px;padding:16px;margin-bottom:16px;background:#FFFBF7">
            <h4 style="margin:0 0 12px">${id ? '编辑插件' : '新增插件'}</h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div><label style="font-size:12px;font-weight:600">插件名称 *</label><input id="pf_name" value="${plugin.name}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px"></div>
                <div><label style="font-size:12px;font-weight:600">图标</label><input id="pf_icon" value="${plugin.icon}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px"></div>
                <div><label style="font-size:12px;font-weight:600">版本号 *</label><input id="pf_version" value="${plugin.version}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px"></div>
                <div><label style="font-size:12px;font-weight:600">支持平台</label><input id="pf_platforms" value="${plugin.platforms}" placeholder="Chrome, Edge" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px"></div>
            </div>
            <div style="margin-top:12px"><label style="font-size:12px;font-weight:600">简介</label><input id="pf_short_desc" value="${(plugin.short_desc||'').replace(/"/g,'&quot;')}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px"></div>
            <div style="margin-top:12px"><label style="font-size:12px;font-weight:600">详细说明</label><textarea id="pf_description" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;min-height:80px">${plugin.description||''}</textarea></div>
            <div style="margin-top:12px"><label style="font-size:12px;font-weight:600">安装教程（每行一步）</label><textarea id="pf_install_guide" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;min-height:80px">${plugin.install_guide||''}</textarea></div>
            <div style="margin-top:12px"><label style="font-size:12px;font-weight:600">已知问题</label><textarea id="pf_known_issues" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;min-height:60px">${plugin.known_issues||''}</textarea></div>
            <div style="margin-top:12px">
                <label style="font-size:12px;font-weight:600">插件文件（zip）</label>
                <div style="display:flex;align-items:center;gap:10px;margin-top:4px">
                    <input type="file" id="pf_file" accept=".zip" style="font-size:13px">
                    ${hasFile ? '<span style="font-size:12px;color:green">✓ 已有文件</span>' : ''}
                </div>
                <input type="hidden" id="pf_download_url" value="${(plugin.download_url||'').replace(/"/g,'&quot;')}">
            </div>
            <div style="margin-top:12px">
                <label style="font-size:12px;font-weight:600">本次更新日志（${id ? '编辑时填写，留空则不新增' : '必填，每行一条'}）</label>
                <textarea id="pf_changelog" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;min-height:60px" placeholder="修复xxx问题&#10;新增xxx功能"></textarea>
            </div>
            <div style="display:flex;gap:8px;margin-top:16px">
                <button onclick="savePluginForm('${id||''}')" style="padding:10px 24px;background:var(--accent);color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600">保存</button>
                <button onclick="document.getElementById('pluginFormArea').innerHTML=''" style="padding:10px 24px;background:#f5f5f5;border:none;border-radius:6px;cursor:pointer">取消</button>
            </div>
        </div>`;
}

async function savePluginForm(id) {
    const fileInput = document.getElementById('pf_file');
    const changelogContent = document.getElementById('pf_changelog').value.trim();

    const payload = {
        name: document.getElementById('pf_name').value.trim(),
        icon: document.getElementById('pf_icon').value.trim(),
        version: document.getElementById('pf_version').value.trim(),
        short_desc: document.getElementById('pf_short_desc').value.trim(),
        description: document.getElementById('pf_description').value.trim(),
        platforms: document.getElementById('pf_platforms').value.trim(),
        install_guide: document.getElementById('pf_install_guide').value.trim(),
        known_issues: document.getElementById('pf_known_issues').value.trim(),
        download_url: document.getElementById('pf_download_url').value.trim(),
        updated_at: new Date().toISOString()
    };

    if (!payload.name || !payload.version) {
        alert('插件名称和版本号为必填');
        return;
    }
    if (!id && !changelogContent) {
        alert('新增插件请填写更新日志');
        return;
    }

    const btn = event.target;
    btn.disabled = true; btn.textContent = '保存中...';

    try {
        // 上传文件到 Supabase Storage
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const ext = file.name.split('.').pop();
            const filePath = `${Date.now()}_${payload.name.replace(/\s+/g,'_')}.${ext}`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('plugins')
                .upload(filePath, file, { upsert: false });

            if (uploadError) throw new Error('文件上传失败：' + uploadError.message);

            const { data: urlData } = supabase.storage
                .from('plugins')
                .getPublicUrl(filePath);

            payload.download_url = urlData.publicUrl;
        }

        // 保存插件信息
        let pluginId = id;
        if (id) {
            const { error } = await supabase.from('plugins').update(payload).eq('id', id);
            if (error) throw error;
        } else {
            const { data, error } = await supabase.from('plugins').insert(payload).select().single();
            if (error) throw error;
            pluginId = data.id;
        }

        // 自动创建更新日志
        if (changelogContent && pluginId) {
            await supabase.from('plugin_changelog').insert({
                plugin_id: pluginId,
                version: payload.version,
                content: changelogContent
            });
        }

        showToast('✅ 保存成功');
        showPluginManagement();
    } catch(e) {
        alert('保存失败：' + e.message);
    }
    btn.disabled = false; btn.textContent = '保存';
}

async function deletePlugin(id) {
    if (!confirm('确定删除此插件？')) return;
    try {
        await supabase.from('plugins').delete().eq('id', id);
        showToast('已删除');
        showPluginManagement();
    } catch(e) {
        alert('删除失败：' + e.message);
    }
}

async function showPluginChangelog(pluginId, pluginName) {
    const content = document.getElementById('adminTabContent');
    content.innerHTML = '<div style="text-align:center;padding:20px">加载中...</div>';

    try {
        const { data: logs } = await supabase
            .from('plugin_changelog')
            .select('*')
            .eq('plugin_id', pluginId)
            .order('created_at', { ascending: false });

        content.innerHTML = `
            <div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
                <div><button onclick="showPluginManagement()" style="background:none;border:none;color:var(--accent);cursor:pointer;font-weight:600">← 返回</button> <span style="font-weight:600">${pluginName} · 更新日志</span></div>
                <button onclick="showChangelogForm('${pluginId}')" style="padding:8px 16px;background:var(--accent);color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600">+ 新增日志</button>
            </div>
            <div id="changelogFormArea"></div>
            <div id="changelogListArea">
                ${(logs||[]).map(l => `
                    <div style="padding:12px;border:1px solid #eee;border-radius:8px;margin-bottom:8px">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                            <strong>${l.version}</strong>
                            <span style="font-size:12px;color:#999">${new Date(l.created_at).toLocaleDateString('zh-CN')}</span>
                        </div>
                        <div style="font-size:13px;color:#555;white-space:pre-wrap">${l.content}</div>
                        <button onclick="deleteChangelog('${l.id}','${pluginId}','${pluginName.replace(/'/g,"\\'")}')" style="margin-top:8px;padding:4px 10px;border:1px solid #FCA5A5;background:#FEE2E2;color:#DC2626;border-radius:4px;cursor:pointer;font-size:11px">删除</button>
                    </div>
                `).join('') || '<p style="color:#999;text-align:center;padding:20px">暂无更新日志</p>'}
            </div>`;
    } catch(e) {
        content.innerHTML = `<p style="color:red">加载失败：${e.message}</p>`;
    }
}

function showChangelogForm(pluginId) {
    document.getElementById('changelogFormArea').innerHTML = `
        <div style="border:2px solid var(--accent);border-radius:8px;padding:16px;margin-bottom:16px;background:#FFFBF7">
            <div style="display:grid;grid-template-columns:1fr 2fr;gap:12px">
                <div><label style="font-size:12px;font-weight:600">版本号</label><input id="cl_version" placeholder="v1.0.0" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px"></div>
                <div><label style="font-size:12px;font-weight:600">更新内容（每行一条）</label><textarea id="cl_content" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;min-height:80px" placeholder="修复xxx问题&#10;新增xxx功能"></textarea></div>
            </div>
            <div style="display:flex;gap:8px;margin-top:12px">
                <button onclick="saveChangelog('${pluginId}')" style="padding:8px 20px;background:var(--accent);color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600">保存</button>
                <button onclick="document.getElementById('changelogFormArea').innerHTML=''" style="padding:8px 20px;background:#f5f5f5;border:none;border-radius:6px;cursor:pointer">取消</button>
            </div>
        </div>`;
}

async function saveChangelog(pluginId) {
    const version = document.getElementById('cl_version').value.trim();
    const content = document.getElementById('cl_content').value.trim();
    if (!version || !content) { alert('版本号和内容为必填'); return; }

    try {
        await supabase.from('plugin_changelog').insert({ plugin_id: pluginId, version, content });
        showToast('✅ 日志已添加');
        // 刷新列表
        const { data: plugin } = await supabase.from('plugins').select('name').eq('id', pluginId).single();
        showPluginChangelog(pluginId, plugin?.name || '');
    } catch(e) {
        alert('保存失败：' + e.message);
    }
}

async function deleteChangelog(logId, pluginId, pluginName) {
    if (!confirm('确定删除此日志？')) return;
    try {
        await supabase.from('plugin_changelog').delete().eq('id', logId);
        showToast('已删除');
        showPluginChangelog(pluginId, pluginName);
    } catch(e) {
        alert('删除失败：' + e.message);
    }
}

// ========== FEEDBACK MANAGEMENT (Admin) ==========
async function showFeedbackManagement() {
    const content = document.getElementById('adminTabContent');
    content.innerHTML = '<div style="text-align:center;padding:20px">加载中...</div>';

    try {
        // 加载反馈和插件列表
        const [{ data: feedbacks }, { data: plugins }] = await Promise.all([
            supabase.from('plugin_feedback').select('*').order('created_at', { ascending: false }),
            supabase.from('plugins').select('id,name')
        ]);

        const pluginMap = {};
        (plugins||[]).forEach(p => pluginMap[p.id] = p.name);

        const typeIcons = { bug:'🐛', feature:'💡', question:'❓' };
        const statusLabels = { pending:'待处理', resolved:'已解决' };

        content.innerHTML = `
            <div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
                <h4 style="margin:0">反馈列表 (${(feedbacks||[]).length})</h4>
                <select id="feedbackFilterPlugin" onchange="filterFeedbackByPlugin()" style="padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px">
                    <option value="">全部插件</option>
                    ${(plugins||[]).map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                </select>
            </div>
            <div id="feedbackListArea">
                ${(feedbacks||[]).length ? (feedbacks||[]).map(f => `
                    <div class="feedback-item" data-plugin="${f.plugin_id}" style="padding:16px;border:1px solid #eee;border-radius:8px;margin-bottom:12px;${f.status==='resolved'?'opacity:0.6':''}">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                            <div>
                                <span style="font-size:14px;font-weight:600">${typeIcons[f.feedback_type]||'💬'} ${f.feedback_type === 'bug' ? 'Bug反馈' : f.feedback_type === 'feature' ? '功能建议' : '使用问题'}</span>
                                <span style="font-size:12px;color:#999;margin-left:8px">${pluginMap[f.plugin_id]||'未知插件'}</span>
                            </div>
                            <span style="font-size:12px;color:#999">${new Date(f.created_at).toLocaleString('zh-CN')}</span>
                        </div>
                        <div style="font-size:12px;color:#666;margin-bottom:6px">用户：${f.user_name||'匿名'}</div>
                        <div style="font-size:14px;color:#333;line-height:1.6;margin-bottom:8px;white-space:pre-wrap">${f.content}</div>
                        ${f.images && f.images.length ? `
                            <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">
                                ${f.images.map(url => `<img src="${url}" style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid #eee;cursor:pointer" onclick="openLightbox('${url.replace(/'/g,"\\'")}')" title="点击预览">`).join('')}
                            </div>
                        ` : ''}
                        <div style="display:flex;gap:8px;align-items:center">
                            <select onchange="updateFeedbackStatus('${f.id}',this.value)" style="padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:12px">
                                <option value="pending" ${f.status==='pending'?'selected':''}>待处理</option>
                                <option value="resolved" ${f.status==='resolved'?'selected':''}>已解决</option>
                            </select>
                            <button onclick="deleteFeedback('${f.id}')" style="padding:4px 10px;border:1px solid #FCA5A5;background:#FEE2E2;color:#DC2626;border-radius:4px;cursor:pointer;font-size:11px">删除</button>
                        </div>
                    </div>
                `).join('') : '<p style="color:#999;text-align:center;padding:30px">暂无反馈</p>'}
            </div>`;
    } catch(e) {
        content.innerHTML = `<p style="color:red">加载失败：${e.message}</p>`;
    }
}

function filterFeedbackByPlugin() {
    const pluginId = document.getElementById('feedbackFilterPlugin').value;
    document.querySelectorAll('.feedback-item').forEach(el => {
        el.style.display = (!pluginId || el.dataset.plugin === pluginId) ? '' : 'none';
    });
}

async function updateFeedbackStatus(id, status) {
    try {
        const { error } = await supabase.from('plugin_feedback').update({ status }).eq('id', id);
        if (error) throw error;
        showToast('状态已更新');
    } catch(e) {
        console.error('更新反馈状态失败:', e);
        showToast('更新失败：' + (e.message || '请检查权限'));
    }
}

async function deleteFeedback(id) {
    if (!confirm('确定删除此反馈？')) return;
    try {
        await supabase.from('plugin_feedback').delete().eq('id', id);
        showToast('已删除');
        showFeedbackManagement();
    } catch(e) {
        alert('删除失败：' + e.message);
    }
}

// ========== A+B 学习系统 ==========

/**
 * 保存用户偏好
 */
async function savePreference(prefKey, prefValue) {
    if (!isLoggedIn() || !supabase) return;

    try {
        const { data, error } = await supabase
            .from('user_preferences')
            .upsert({
                user_id: currentUser.id,
                pref_key: prefKey,
                pref_value: prefValue,
                use_count: 1,
                last_used_at: new Date().toISOString()
            }, {
                onConflict: 'user_id,pref_key,pref_value',
                ignoreDuplicates: false
            });

        if (error) {
            // 如果 upsert 失败，尝试更新 use_count
            const { data: existing } = await supabase
                .from('user_preferences')
                .select('id, use_count')
                .eq('user_id', currentUser.id)
                .eq('pref_key', prefKey)
                .eq('pref_value', prefValue)
                .single();

            if (existing) {
                await supabase
                    .from('user_preferences')
                    .update({
                        use_count: existing.use_count + 1,
                        last_used_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);
            }
        }
    } catch (e) {
        console.warn('保存偏好失败:', e);
    }
}

/**
 * 获取用户偏好（按使用次数排序）
 */
async function getUserPreferences(prefKey) {
    if (!isLoggedIn() || !supabase) return [];

    try {
        const { data, error } = await supabase
            .from('user_preferences')
            .select('pref_value, use_count')
            .eq('user_id', currentUser.id)
            .eq('pref_key', prefKey)
            .order('use_count', { ascending: false })
            .limit(5);

        if (error) throw error;
        return data ? data.map(d => d.pref_value) : [];
    } catch (e) {
        console.warn('获取偏好失败:', e);
        return [];
    }
}

/**
 * 保存生成历史 + 评分
 */
async function saveGenerationHistory(genType, inputParams, outputContent, rating = null) {
    if (!isLoggedIn() || !supabase) return null;

    try {
        const { data, error } = await supabase
            .from('generation_history')
            .insert({
                user_id: currentUser.id,
                gen_type: genType,
                input_params: inputParams,
                output_content: outputContent,
                rating: rating
            })
            .select('id')
            .single();

        if (error) throw error;
        return data?.id;
    } catch (e) {
        console.warn('保存生成历史失败:', e);
        return null;
    }
}

/**
 * 更新评分
 */
async function updateGenerationRating(historyId, rating) {
    if (!isLoggedIn() || !supabase || !historyId) return;

    try {
        const { error } = await supabase
            .from('generation_history')
            .update({ rating })
            .eq('id', historyId)
            .eq('user_id', currentUser.id);

        if (error) throw error;
    } catch (e) {
        console.warn('更新评分失败:', e);
    }
}

/**
 * 获取高分历史内容（用于注入提示词）
 */
async function getHighRatedExamples(genType, limit = 3) {
    if (!isLoggedIn() || !supabase) return [];

    try {
        const { data, error } = await supabase
            .from('generation_history')
            .select('output_content, input_params')
            .eq('user_id', currentUser.id)
            .eq('gen_type', genType)
            .gte('rating', 4)
            .order('rating', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    } catch (e) {
        console.warn('获取高分示例失败:', e);
        return [];
    }
}

/**
 * 保存反馈记录
 */
async function saveFeedback(feedbackData) {
    if (!isLoggedIn() || !supabase) return null;

    try {
        const { data, error } = await supabase
            .from('feedback')
            .insert({
                user_id: currentUser.id,
                history_id: feedbackData.history_id || null,
                gen_type: feedbackData.gen_type,
                original_content: feedbackData.original_content,
                feedback_text: feedbackData.feedback_text,
                improved_content: feedbackData.improved_content,
                changes_summary: feedbackData.changes_summary,
                learnings: feedbackData.learnings,
                rating: feedbackData.rating
            })
            .select('id')
            .single();

        if (error) throw error;
        return data?.id;
    } catch (e) {
        console.warn('保存反馈失败:', e);
        return null;
    }
}

/**
 * 获取反馈列表
 */
async function getFeedbackList(genType = null, limit = 50) {
    if (!isLoggedIn() || !supabase) return [];

    try {
        let query = supabase
            .from('feedback')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (genType) {
            query = query.eq('gen_type', genType);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.warn('获取反馈列表失败:', e);
        return [];
    }
}

/**
 * 获取生成历史列表
 */
async function getGenerationHistoryList(genType = null, limit = 50) {
    if (!isLoggedIn() || !supabase) return [];

    try {
        let query = supabase
            .from('generation_history')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (genType && genType !== 'all') {
            query = query.eq('gen_type', genType);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.warn('获取生成历史失败:', e);
        return [];
    }
}

// ========== USER ASSETS (素材库 Supabase) ==========

async function saveUserAsset(asset) {
    if (!isLoggedIn() || !supabase) return null;
    try {
        const { data, error } = await supabase
            .from('user_assets')
            .insert({
                user_id: currentUser.id,
                id: asset.id,
                type: asset.type,
                title: asset.title,
                content: asset.content,
                rating: asset.rating || null
            })
            .select('id')
            .single();
        if (error) throw error;
        return data?.id;
    } catch (e) {
        console.warn('保存素材失败:', e);
        return null;
    }
}

async function getUserAssets() {
    if (!isLoggedIn() || !supabase) return [];
    try {
        const { data, error } = await supabase
            .from('user_assets')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.warn('获取素材失败:', e);
        return [];
    }
}

async function updateUserAssetRating(id, rating) {
    if (!isLoggedIn() || !supabase) return;
    try {
        await supabase.from('user_assets').update({ rating }).eq('id', id);
    } catch (e) {
        console.warn('更新素材评分失败:', e);
    }
}

async function deleteUserAssets(ids) {
    if (!isLoggedIn() || !supabase || !ids.length) return;
    try {
        await supabase.from('user_assets').delete().in('id', ids);
    } catch (e) {
        console.warn('删除素材失败:', e);
    }
}

// ========== USER BRANDS (自定义品牌 Supabase) ==========

async function saveUserBrand(brand) {
    if (!isLoggedIn() || !supabase) return;
    try {
        await supabase.from('user_brands').upsert({
            id: brand.id,
            user_id: currentUser.id,
            name: brand.name,
            description: brand.desc || '',
            tone: brand.tone || '',
            selling_points: brand.points || ''
        }, { onConflict: 'id' });
    } catch (e) {
        console.warn('保存品牌失败:', e);
    }
}

async function getUserBrands() {
    if (!isLoggedIn() || !supabase) return [];
    try {
        const { data, error } = await supabase
            .from('user_brands')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(b => ({
            id: b.id,
            name: b.name,
            desc: b.description,
            tone: b.tone,
            points: b.selling_points
        }));
    } catch (e) {
        console.warn('获取品牌失败:', e);
        return [];
    }
}

async function deleteUserBrand(id) {
    if (!isLoggedIn() || !supabase) return;
    try {
        await supabase.from('user_brands').delete().eq('id', id).eq('user_id', currentUser.id);
    } catch (e) {
        console.warn('删除品牌失败:', e);
    }
}

// ========== USER TEMPLATES (提示词模板 Supabase) ==========

async function saveUserTemplate(tpl) {
    if (!isLoggedIn() || !supabase) return;
    try {
        await supabase.from('user_templates').upsert({
            id: tpl.id,
            user_id: currentUser.id,
            name: tpl.name,
            prompt: tpl.prompt,
            size: tpl.size || '1024x1024'
        }, { onConflict: 'id' });
    } catch (e) {
        console.warn('保存模板失败:', e);
    }
}

async function getUserTemplates() {
    if (!isLoggedIn() || !supabase) return [];
    try {
        const { data, error } = await supabase
            .from('user_templates')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(t => ({
            id: t.id,
            name: t.name,
            prompt: t.prompt,
            size: t.size
        }));
    } catch (e) {
        console.warn('获取模板失败:', e);
        return [];
    }
}

async function deleteUserTemplate(id) {
    if (!isLoggedIn() || !supabase) return;
    try {
        await supabase.from('user_templates').delete().eq('id', id).eq('user_id', currentUser.id);
    } catch (e) {
        console.warn('删除模板失败:', e);
    }
}

// ========== LOCALSTORAGE → SUPABASE 一次性迁移 ==========

async function migrateLocalStorageToSupabase() {
    if (!isLoggedIn() || !supabase) return;

    try {
        // 1. 迁移素材
        const localAssets = JSON.parse(localStorage.getItem('menlil_assets') || '[]');
        if (localAssets.length > 0) {
            const existing = await getUserAssets();
            const existingIds = new Set(existing.map(a => String(a.id)));
            const toMigrate = localAssets.filter(a => !existingIds.has(String(a.id)));
            for (const asset of toMigrate) {
                await saveUserAsset(asset);
            }
            console.log(`迁移了 ${toMigrate.length} 个素材到 Supabase`);
        }

        // 2. 迁移品牌
        const localBrands = JSON.parse(localStorage.getItem('custom_brands') || '[]');
        if (localBrands.length > 0) {
            const existing = await getUserBrands();
            const existingIds = new Set(existing.map(b => b.id));
            const toMigrate = localBrands.filter(b => !existingIds.has(b.id));
            for (const brand of toMigrate) {
                await saveUserBrand(brand);
            }
            console.log(`迁移了 ${toMigrate.length} 个品牌到 Supabase`);
        }

        // 3. 迁移模板
        const localTemplates = JSON.parse(localStorage.getItem('prompt_templates') || '[]');
        if (localTemplates.length > 0) {
            const existing = await getUserTemplates();
            const existingIds = new Set(existing.map(t => t.id));
            const toMigrate = localTemplates.filter(t => !existingIds.has(t.id));
            for (const tpl of toMigrate) {
                await saveUserTemplate(tpl);
            }
            console.log(`迁移了 ${toMigrate.length} 个模板到 Supabase`);
        }
    } catch (e) {
        console.warn('localStorage 迁移失败:', e);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
    console.log('初始化权限系统...');

    // 先显示登录按钮（不依赖 Supabase）
    updateAuthUI();

    // 然后尝试初始化 Supabase
    try {
        const success = await initSupabase();
        if (success) {
            console.log('权限系统初始化完成');
        } else {
            console.error('权限系统初始化失败');
        }
    } catch (error) {
        console.error('Supabase 初始化出错:', error);
    }
});

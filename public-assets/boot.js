/**
 * 萌力互动 · Boot Loader
 * 分层启动，错误隔离，单点故障不影响系统
 */

window.MENGLI = window.MENGLI || {};

// ===== safeRun：错误隔离包装器 =====
window.MENGLI.safeRun = function safeRun(name, fn) {
    try {
        const result = fn();
        // 处理异步函数的 Promise rejection
        if (result && typeof result.catch === 'function') {
            result.catch(e => console.error(`[boot] ${name} 异步失败:`, e));
        }
        return result;
    } catch (e) {
        console.error(`[boot] ${name} 启动失败:`, e);
        return null;
    }
};

// ===== DOMContentLoaded 统一启动 =====
document.addEventListener('DOMContentLoaded', async () => {
    const safeRun = window.MENGLI.safeRun;
    console.log('[boot] 开始初始化...');

    // 1. UI 层（必须成功，提供 fallback 按钮）
    safeRun('updateAuthUI', () => {
        if (typeof updateAuthUI === 'function') updateAuthUI();
    });

    // 2. 认证层（允许失败）
    await safeRun('auth-init', async () => {
        if (typeof initAuth === 'function') await initAuth();
    });

    // 3. 功能配置（允许失败）
    await safeRun('features', async () => {
        if (typeof loadAllFeatures === 'function') await loadAllFeatures();
    });

    // 4. 权限应用（允许失败）
    safeRun('permissions', () => {
        if (typeof applyPermissions === 'function') applyPermissions();
    });

    // 5. 页面级初始化（允许失败）
    safeRun('page-init', () => {
        if (typeof initPageFeatures === 'function') initPageFeatures();
    });

    console.log('[boot] 初始化完成');
});

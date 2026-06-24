/**
 * 萌力互动 · 全局状态管理
 * 使用 Proxy 实现响应式状态
 */

const _state = {
  // ===== 认证状态 =====
  currentUser: null,
  userProfile: null,
  userPermissions: [],
  allFeatures: [],

  // ===== UI 状态 =====
  currentPage: 'home',
  currentPlatform: 'xhs',
  activeTag: null,

  // ===== 找号 =====
  kolList: [],
  cart: [],

  // ===== 图片生成 =====
  imgSize: '1024x1024',
  imgMode: 'txt2img',
  img2imgFiles: [],
  maskEditorOpen: false,
  compareActive: false,

  // ===== 文案 =====
  _lastCopyText: '',
  _copyVersions: [],
  _copyCurrentVersionIdx: 0,
  _copyRootId: null,
  _copyEditMode: false,

  // ===== 文章 =====
  _lastArticleText: '',
  articleFiles: [],
  articleMode: 'draft',

  // ===== 素材库 =====
  assets: [],
  currentAssetTab: 'all',
  assetsPage: 1,
  currentRatingFilter: 0,
  batchMode: false,
  selectedAssets: [],

  // ===== 品牌/模板 =====
  customBrands: [],
  customTemplates: [],

  // ===== 插件 =====
  pluginList: [],
  currentPlugin: null,
  currentPluginChangelog: [],
  pluginFeedbackType: 'suggestion',
  feedbackImages: [],

  // ===== 数据分析 =====
  analysisFiles: [],
  analysisResult: null,

  // ===== 灯箱 =====
  lightboxGallery: [],
  lightboxIndex: 0,
  lightboxScale: 1,
};

// 订阅者 Map
const _listeners = new Map();

// Proxy 包装
export const state = new Proxy(_state, {
  set(target, key, value) {
    const old = target[key];
    target[key] = value;
    // 通知订阅者
    const keyListeners = _listeners.get(key);
    if (keyListeners) {
      keyListeners.forEach(fn => {
        try { fn(value, old); } catch (e) { console.error('[state] 订阅者错误:', e); }
      });
    }
    return true;
  }
});

/**
 * 订阅状态变化
 * @param {string} key - 状态键名
 * @param {Function} callback - 回调函数 (newValue, oldValue)
 * @returns {Function} 取消订阅函数
 */
export function subscribe(key, callback) {
  if (!_listeners.has(key)) _listeners.set(key, new Set());
  _listeners.get(key).add(callback);
  return () => _listeners.get(key).delete(callback);
}

/**
 * 批量更新状态（只触发一次通知）
 */
export function batchUpdate(updates) {
  Object.entries(updates).forEach(([key, value]) => {
    state[key] = value;
  });
}

// 暴露到全局（过渡期兼容）
window.appState = state;
window.subscribeState = subscribe;

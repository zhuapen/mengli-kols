/**
 * 萌力互动 · 全局状态管理
 * Proxy-based 响应式状态
 */

const _state = {
  // 认证
  currentUser: null,
  userProfile: null,
  userPermissions: [],
  allFeatures: [],

  // UI
  currentPage: 'home',
  currentPlatform: 'xhs',
  activeTag: null,

  // 业务
  kolList: [],
  cart: [],
  assets: [],
  pluginList: [],
  tasks: [],
  briefs: [],
  kols: [],

  // 图片生成
  imgSize: '1024x1024',
  imgMode: 'txt2img',
  img2imgFiles: [],

  // 文案
  _lastCopyText: '',
  _copyVersions: [],
  _copyCurrentVersionIdx: 0,

  // 文章
  _lastArticleText: '',
  articleFiles: [],
  articleMode: 'draft',

  // 素材库
  currentAssetTab: 'all',
  assetsPage: 1,
  batchMode: false,
  selectedAssets: [],

  // 品牌/模板
  customBrands: [],
  customTemplates: [],

  // 插件
  currentPlugin: null,
  currentPluginChangelog: [],
  pluginFeedbackType: 'suggestion',
  feedbackImages: [],

  // 数据分析
  analysisFiles: [],
  analysisResult: null,

  // 灯箱
  lightboxGallery: [],
  lightboxIndex: 0,
  lightboxScale: 1,
};

const _listeners = new Map();

export const state = new Proxy(_state, {
  set(target, key, value) {
    const old = target[key];
    target[key] = value;
    const keyListeners = _listeners.get(key);
    if (keyListeners) {
      keyListeners.forEach(fn => {
        try { fn(value, old); } catch (e) { console.error('[state] 订阅者错误:', e); }
      });
    }
    return true;
  }
});

export function subscribe(key, callback) {
  if (!_listeners.has(key)) _listeners.set(key, new Set());
  _listeners.get(key).add(callback);
  return () => _listeners.get(key).delete(callback);
}

export function initState() {
  // 初始化状态（从 localStorage 恢复等）
  console.log('[state] 状态初始化完成');
}

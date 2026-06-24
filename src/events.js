/**
 * 萌力互动 · 全局事件委托
 * 用 data-action 替代 onclick 内联事件
 */

// ===== Action 注册表 =====
const actions = {
  // 导航
  'show-page': (e, el) => { const page = el.dataset.page || el.getAttribute('data-page'); if (page) showPage(page); },
  'show-login': () => showLoginModal(),
  'show-register': () => showRegisterModal(),
  'show-plugin-list': () => showPluginList(),
  'show-admin': () => showAdminPanel(),

  // 注册
  'close-register': () => closeRegisterModal(),

  // 文案
  'gen-copy': () => genCopyStream(),
  'refine-copy': () => refineCopy(),
  'toggle-copy-edit': () => toggleCopyEdit(),
  'quick-refine': (e, el) => { const text = el.dataset.refine || el.getAttribute('data-refine'); if (text) quickRefine(text); },

  // 图片
  'gen-image': () => genImage(),
  'open-mask-editor': () => openMaskEditor(),
  'close-mask-editor': () => closeMaskEditor(),
  'set-mask-tool': (e, el) => { const tool = el.dataset.tool || el.getAttribute('data-tool'); if (tool) setMaskTool(tool); },
  'undo-mask': () => undoMask(),
  'clear-mask': () => clearMask(),
  'confirm-mask': () => confirmMask(),
  'switch-img-mode': (e, el) => { const mode = el.dataset.mode || el.getAttribute('data-mode'); if (mode) switchImgMode(mode, el); },
  'set-img-size': (e, el) => { const size = el.dataset.size || el.getAttribute('data-size'); if (size) setImgSize(size, el); },
  'toggle-compare': () => toggleCompare(),
  'open-file-input': (e, el) => { const target = el.dataset.target || el.getAttribute('data-target'); if (target) document.getElementById(target)?.click(); },

  // 文章
  'gen-article': () => genArticleStream(),
  'set-article-mode': (e, el) => { const mode = el.dataset.mode || el.getAttribute('data-mode'); if (mode) setArticleMode(mode, el); },
  'copy-article': () => copyArticle(),

  // 素材库
  'switch-assets-tab': (e, el) => { const tab = el.dataset.tab || el.getAttribute('data-tab'); if (tab) switchAssetsTab(tab, el); },
  'toggle-batch-mode': () => toggleBatchMode(),
  'select-all-assets': () => selectAllAssets(),
  'delete-selected-assets': () => deleteSelectedAssets(),
  'filter-by-rating': (e, el) => { const rating = el.dataset.rating || el.getAttribute('data-rating'); filterByRating(rating, el); },

  // 历史
  'filter-history': (e, el) => { const type = el.dataset.type || el.getAttribute('data-type'); filterHistory(el, type); },

  // 购物车
  'open-cart': () => openCart(),
  'close-cart': () => closeCart(),
  'submit-inquiry': () => submitInquiry(),

  // 品牌
  'open-add-brand': () => openAddBrandModal(),
  'close-add-brand': () => closeAddBrandModal(),
  'save-brand': () => saveBrand(),

  // 模板
  'toggle-template-panel': () => toggleTemplatePanel(),

  // 灯箱
  'close-lightbox': (e) => closeLightbox(e),
  'lightbox-nav': (e, el) => { const dir = parseInt(el.dataset.dir || el.getAttribute('data-dir') || '0'); lightboxNav(dir); },
  'lightbox-zoom': (e, el) => { const dir = parseInt(el.dataset.dir || el.getAttribute('data-dir') || '0'); lightboxZoom(dir); },
  'download-image': () => downloadImage(),
  'open-lightbox': (e, el) => { const src = el.dataset.src || el.src; if (src) openLightbox(src); },

  // 反馈
  'close-feedback': () => closeFeedbackModal(),
  'submit-feedback': () => submitFeedback(),

  // KOL
  'start-find-flow': () => startFindFlow(),
  'analyze-brief': () => analyzeBrief(),
  'load-demo-brief': () => loadDemoBrief(),

  // 数据中心
  'open-database-view': () => openDatabaseView(),
  'open-project-management': () => openProjectManagementView(),
  'open-new-project-wizard': () => openNewProjectWizard(),
  'open-project-wizard': () => { if (typeof currentProjectId !== 'undefined') openProjectWizard(currentProjectId); },
  'save-confirmed-analysis': () => saveConfirmedAnalysis(),
  'save-feedback-result': () => saveFeedbackResult(),
  'save-feedback-memory': () => saveFeedbackMemory(),
  'clear-project-memory': () => clearProjectMemory(),
  'toggle-recommendation-export': () => toggleRecommendationExportMenu(),
  'export-recommendations': (e, el) => { const mode = el.dataset.mode || el.getAttribute('data-mode') || 'all'; exportRecommendations(mode); },

  // 文本弹窗
  'close-text-modal': () => closeTextModal(),
  'copy-text': () => copyText(),
  'copy-modal-text': () => copyModalText(),

  // 保存为模板
  'save-as-template': (e, el) => {
    const type = el.dataset.type || el.getAttribute('data-type');
    const outputId = el.dataset.output || el.getAttribute('data-output');
    const outputEl = document.getElementById(outputId);
    if (type && outputEl) saveAsTemplate(type, outputEl.textContent);
  },

  // 知识库
  'toggle-knowledge-card': (e, el) => toggleKnowledgeCard(el),

  // 阻止冒泡
  'stop-propagation': (e) => e.stopPropagation(),
};

// ===== 全局事件委托 =====
document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;
  if (!action) return;

  const handler = actions[action];
  if (handler) {
    // 某些 action 不需要 preventDefault（如外部链接）
    if (action !== 'stop-propagation') {
      e.preventDefault();
    }
    handler(e, target);
  } else {
    console.warn('[events] 未注册的 action:', action);
  }
});

// ===== 暴露到全局（供动态注册）=====
window.registerAction = function(name, handler) {
  actions[name] = handler;
};

window.registerActions = function(obj) {
  Object.assign(actions, obj);
};

console.log('[events] 事件委托已加载，注册', Object.keys(actions).length, '个 action');

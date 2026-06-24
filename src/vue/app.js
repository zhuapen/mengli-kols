/**
 * 萌力互动 · Vue 3 应用入口
 * 渐进式迁移：只挂载需要的组件，其他保持 legacy 代码
 */

import { createApp, ref } from 'vue';
import LoginModal from './components/LoginModal.vue';
import CopyPage from './components/CopyPage.vue';

// ===== 登录弹窗 =====
const loginApp = createApp({
  setup() {
    const loginModal = ref(null);
    return { loginModal };
  },
  template: '<LoginModal ref="loginModal" />'
});

loginApp.component('LoginModal', LoginModal);

const loginMount = document.getElementById('vue-login-mount');
let loginInstance = null;

if (loginMount) {
  loginInstance = loginApp.mount(loginMount);
  // 暴露到全局供 legacy 代码调用
  window.vueLoginModal = loginInstance.loginModal;
}

// ===== 文案页 =====
const copyApp = createApp({
  setup() {
    const copyPage = ref(null);
    return { copyPage };
  },
  template: '<CopyPage ref="copyPage" :active="true" />'
});

copyApp.component('CopyPage', CopyPage);

const copyMount = document.getElementById('vue-copy-mount');
let copyInstance = null;

if (copyMount) {
  copyInstance = copyApp.mount(copyMount);
  window.vueCopyPage = copyInstance.copyPage;
}

// ===== 兼容层：重写 showLoginModal =====
const _legacyShowLoginModal = window.showLoginModal;
window.showLoginModal = function() {
  if (window.vueLoginModal) {
    window.vueLoginModal.open();
  } else if (_legacyShowLoginModal) {
    _legacyShowLoginModal();
  }
};

// ===== 页面切换时显示/隐藏 Vue 组件 =====
const _origShowPage = window.showPage;
if (_origShowPage) {
  window.showPage = function(page) {
    // 调用原始 showPage
    _origShowPage(page);

    // 显示/隐藏 Vue 文案页
    const vueCopyMount = document.getElementById('vue-copy-mount');
    const legacyCopyPage = document.getElementById('pageCopy');

    if (vueCopyMount && legacyCopyPage) {
      if (page === 'copy') {
        vueCopyMount.style.display = 'block';
        legacyCopyPage.style.display = 'none';
      } else {
        vueCopyMount.style.display = 'none';
      }
    }
  };
}

console.log('[vue-app] Vue 应用已挂载');

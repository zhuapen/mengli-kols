/**
 * 萌力互动 · Vue Router 配置
 */
import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/HomePage.vue'),
  },
  {
    path: '/media',
    name: 'Media',
    component: () => import('../views/MediaPage.vue'),
  },
  {
    path: '/copy',
    name: 'Copy',
    component: () => import('../views/CopyPage.vue'),
  },
  {
    path: '/image',
    name: 'Image',
    component: () => import('../views/ImagePage.vue'),
  },
  {
    path: '/assets',
    name: 'Assets',
    component: () => import('../views/AssetsPage.vue'),
  },
  {
    path: '/history',
    name: 'History',
    component: () => import('../views/HistoryPage.vue'),
  },
  {
    path: '/datacenter',
    name: 'DataCenter',
    component: () => import('../views/DataCenterPage.vue'),
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

// 路由守卫
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('mengli_token');
  if (to.meta.requiresAuth && !token) {
    next('/');
  } else {
    next();
  }
});

export default router;

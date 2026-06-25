/**
 * 萌力互动 · Vue Router 配置
 */
import { createRouter, createWebHashHistory } from 'vue-router';
import { setupGuard } from './guard.js';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/HomePage.vue'),
    meta: { title: '首页' },
  },
  {
    path: '/media',
    name: 'Media',
    component: () => import('../views/MediaPage.vue'),
    meta: { title: '智能媒体库', requiresAuth: true },
  },
  {
    path: '/copy',
    name: 'Copy',
    component: () => import('../views/CopyPage.vue'),
    meta: { title: '文案撰写', requiresAuth: true },
  },
  {
    path: '/image',
    name: 'Image',
    component: () => import('../views/ImagePage.vue'),
    meta: { title: '图片生成', requiresAuth: true },
  },
  {
    path: '/assets',
    name: 'Assets',
    component: () => import('../views/AssetsPage.vue'),
    meta: { title: '素材库', requiresAuth: true },
  },
  {
    path: '/history',
    name: 'History',
    component: () => import('../views/HistoryPage.vue'),
    meta: { title: '历史记录', requiresAuth: true },
  },
  {
    path: '/datacenter',
    name: 'DataCenter',
    component: () => import('../views/DataCenterPage.vue'),
    meta: { title: '数据中心', requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

// 统一设置路由守卫
setupGuard(router);

export default router;

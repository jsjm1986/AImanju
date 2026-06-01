import { useAuthStore } from '@/stores/authStore';
import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'Projects',
    component: () => import('@/views/ProjectsPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginPage.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/docs',
    name: 'Docs',
    component: () => import('@/views/EngineeringPage.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/project/:id',
    name: 'ProjectDetail',
    component: () => import('@/views/ProjectDetail.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: 'outline',
        name: 'Outline',
        component: () => import('@/views/OutlinePage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'characters',
        name: 'Characters',
        component: () => import('@/views/CharactersPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'script',
        name: 'Script',
        component: () => import('@/views/ScriptPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'validation',
        name: 'Validation',
        component: () => import('@/views/ValidationPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'preview',
        name: 'Preview',
        component: () => import('@/views/PreviewPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'engineering',
        name: 'Engineering',
        component: () => import('@/views/EngineeringPage.vue'),
        meta: { requiresAuth: false },
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// 路由守卫
router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore();
  
  // 如果路由需要认证且用户未登录
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    // 跳转到登录页，并记录原目标路由
    next({ name: 'Login', query: { redirect: to.fullPath } });
  } else if (to.name === 'Login' && authStore.isAuthenticated) {
    // 已登录用户访问登录页，跳转到首页
    next({ name: 'Projects' });
  } else {
    next();
  }
});

export default router;

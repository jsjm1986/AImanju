import { useAuthStore } from '@/stores/authStore';
import { useAgentStore } from '@/stores/agentStore';
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
    path: '/creator-admin',
    name: 'CreatorAdmin',
    component: () => import('@/views/CreatorAdminPage.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/admin',
    redirect: '/creator-admin',
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
      {
        path: 'tasks',
        name: 'Tasks',
        component: () => import('@/views/TasksPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'settings',
        name: 'ProjectSettings',
        component: () => import('@/views/ProjectSettings.vue'),
        meta: { requiresAuth: true },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
  // 代理端路由
  {
    path: '/agent/login',
    name: 'AgentLogin',
    component: () => import('@/views/agent/AgentLoginPage.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/agent',
    component: () => import('@/views/agent/AgentLayout.vue'),
    meta: { requiresAgentAuth: true },
    children: [
      {
        path: '',
        redirect: '/agent/dashboard',
      },
      {
        path: 'dashboard',
        name: 'AgentDashboard',
        component: () => import('@/views/agent/AgentDashboardPage.vue'),
        meta: { requiresAgentAuth: true },
      },
      {
        path: 'creators',
        name: 'AgentCreators',
        component: () => import('@/views/agent/AgentCreatorsPage.vue'),
        meta: { requiresAgentAuth: true },
      },
      {
        path: 'invite',
        name: 'AgentInvite',
        component: () => import('@/views/agent/AgentInvitePage.vue'),
        meta: { requiresAgentAuth: true },
      },
      {
        path: 'allocations',
        name: 'AgentAllocations',
        component: () => import('@/views/agent/AgentAllocationsPage.vue'),
        meta: { requiresAgentAuth: true },
      },
      {
        path: 'profile',
        name: 'AgentProfile',
        component: () => import('@/views/agent/AgentProfilePage.vue'),
        meta: { requiresAgentAuth: true },
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, _from, next) => {
  // 代理端路由守卫
  if (to.meta.requiresAgentAuth) {
    const agentStore = useAgentStore();
    if (!agentStore.isAuthenticated) {
      next({ name: 'AgentLogin' });
      return;
    }
  }

  // 代理已登录访问代理登录页
  if (to.name === 'AgentLogin') {
    const agentStore = useAgentStore();
    if (agentStore.isAuthenticated) {
      next({ name: 'AgentDashboard' });
      return;
    }
  }

  // 创作者端路由守卫
  if (to.meta.requiresAuth && !to.meta.requiresAgentAuth) {
    const authStore = useAuthStore();
    if (!authStore.isAuthenticated) {
      next({ name: 'Login', query: { redirect: to.fullPath } });
      return;
    }
    if (to.meta.requiresAdmin && authStore.user?.role !== 'admin') {
      next({ name: 'Projects' });
      return;
    }
  }

  if (to.name === 'Login') {
    const authStore = useAuthStore();
    if (authStore.isAuthenticated) {
      next({ name: 'Projects' });
      return;
    }
  }

  next();
});

export default router;

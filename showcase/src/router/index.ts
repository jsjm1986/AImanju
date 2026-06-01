import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';

const routes = [
    {
        path: '/',
        name: 'Home',
        component: () => import('@/views/HomePage.vue'),
    },
    {
        path: '/login',
        name: 'Login',
        component: () => import('@/views/LoginPage.vue'),
        meta: { guest: true },
    },
    {
        path: '/register',
        name: 'Register',
        component: () => import('@/views/RegisterPage.vue'),
        meta: { guest: true },
    },
    {
        path: '/projects/:id',
        name: 'Project',
        component: () => import('@/views/ProjectPage.vue'),
    },
    {
        path: '/projects/:id/read/:episode',
        name: 'Read',
        component: () => import('@/views/ReadPage.vue'),
        meta: { requiresAuth: true },
    },
    {
        path: '/admin',
        name: 'Admin',
        component: () => import('@/views/AdminPage.vue'),
        meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
        path: '/profile',
        name: 'Profile',
        component: () => import('@/views/ProfilePage.vue'),
        meta: { requiresAuth: true },
    },
    {
        path: '/join',
        name: 'Join',
        component: () => import('@/views/JoinPage.vue'),
    },
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

// 路由守卫
router.beforeEach((to, _from, next) => {
    const authStore = useAuthStore();

    // 需要登录的页面
    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
        next({ name: 'Login', query: { redirect: to.fullPath } });
        return;
    }

    // 需要管理员权限
    if (to.meta.requiresAdmin && !authStore.isAdmin) {
        next({ name: 'Home' });
        return;
    }

    // 已登录用户访问登录/注册页
    if (to.meta.guest && authStore.isAuthenticated) {
        next({ name: 'Home' });
        return;
    }

    next();
});

export default router;

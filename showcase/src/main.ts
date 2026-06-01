import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { useAuthStore } from './stores/authStore';
import { useThemeStore } from './stores/themeStore';

// 导入新设计系统
import './design-system/index.css';
// 保留旧主题兼容 (可逐步移除)
import './styles/themes.css';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

// 初始化主题系统
const themeStore = useThemeStore();
themeStore.applyTheme();

// 初始化认证状态
const authStore = useAuthStore();
authStore.init().then(() => {
    app.mount('#app');
});

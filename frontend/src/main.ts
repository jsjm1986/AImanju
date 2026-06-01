import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from './router';
import App from './App.vue';
import { setupErrorHandling } from './utils/errorHandler';
import './styles/index.css';

const app = createApp(App);

app.use(createPinia());
app.use(router);

// 设置全局错误处理
setupErrorHandling(app);

app.mount('#app');

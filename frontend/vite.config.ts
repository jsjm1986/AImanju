import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// 开发与预览共享同一 /api 代理；可用 API_PROXY_TARGET 覆盖审计目标
const apiProxy = {
  '/api': {
    target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:8333',
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '0.0.0.0',  // 允许局域网访问
    port: Number(process.env.VITE_DEV_PORT) || 5173,
    strictPort: false,
    proxy: apiProxy,
  },
  preview: {
    host: '0.0.0.0',
    port: Number(process.env.VITE_PREVIEW_PORT) || 8884,
    strictPort: true,
    proxy: apiProxy,
  },
})

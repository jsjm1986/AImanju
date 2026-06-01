// PM2 配置文件
module.exports = {
  apps: [
    {
      name: 'comic-backend',
      cwd: './backend',
      script: 'dist/app.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 8333
      }
    },
    {
      name: 'comic-frontend',
      cwd: './frontend',
      script: 'node_modules/.bin/vite',
      args: 'preview --port 8884 --host 0.0.0.0',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};

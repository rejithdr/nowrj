// pm2 keeps the backend and the website running and restarts them on crash or reboot.
module.exports = {
  apps: [
    {
      name: 'nowrj-backend',
      cwd: '/srv/nowrj/backend',
      script: 'dist/main.js',
      env_production: { NODE_ENV: 'production', PORT: '3000', TZ: 'Asia/Kolkata' },
      max_memory_restart: '500M',
    },
    {
      name: 'nowrj-web',
      cwd: '/srv/nowrj/frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3001 -H 127.0.0.1',
      env_production: { NODE_ENV: 'production', TZ: 'Asia/Kolkata' },
      max_memory_restart: '600M',
    },
  ],
};

export default {
  apps: [
    {
      name: "owly-whatsapp-service",
      script: "index.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 4000,
        SESSION_PATH: process.env.SESSION_PATH || "./sessions",
      },
    },
  ],
};

module.exports = {
  apps: [
    {
      name: "auditoria-scc",
      script: "src/index.js",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      env: {
        NODE_ENV: "production",
        TZ: "America/Sao_Paulo",
      },
    },
  ],
};

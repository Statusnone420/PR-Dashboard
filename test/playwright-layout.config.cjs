const { defineConfig } = require('@playwright/test');
const path = require('node:path');

const port = process.env.PR_DASHBOARD_LAYOUT_PORT || '3000';
const host = `http://127.0.0.1:${port}`;

module.exports = defineConfig({
  webServer: {
    command: `node node_modules/vite/bin/vite.js build && node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${port}`,
    cwd: path.resolve(__dirname, '..'),
    url: host,
    reuseExistingServer: true,
    timeout: 120000
  }
});

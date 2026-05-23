const { defineConfig } = require('@playwright/test');
const path = require('node:path');

const port = process.env.PR_DASHBOARD_README_PORT || '4174';
const host = `http://127.0.0.1:${port}`;

module.exports = defineConfig({
  webServer: {
    command: `npm run build && npx vite preview --host 127.0.0.1 --port ${port}`,
    cwd: path.resolve(__dirname, '..'),
    url: host,
    reuseExistingServer: false,
    timeout: 120000
  },
  use: {
    baseURL: host
  }
});

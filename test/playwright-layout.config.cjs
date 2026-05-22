const { defineConfig } = require('@playwright/test');
const path = require('node:path');

module.exports = defineConfig({
  webServer: {
    command: 'npm run build && npx vite preview --host 127.0.0.1 --port 3000',
    cwd: path.resolve(__dirname, '..'),
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: true,
    timeout: 120000
  }
});

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 2,
  workers: 1,
  webServer: {
    command: 'python3 -m http.server 3399 -d docs',
    port: 3399,
    reuseExistingServer: true,
    timeout: 10000,
  },
  use: {
    baseURL: 'http://localhost:3399',
    viewport: { width: 390, height: 844 },
    locale: 'ja-JP',
    launchOptions: {
      executablePath: '/opt/pw-browsers/chromium',
    },
  },
});

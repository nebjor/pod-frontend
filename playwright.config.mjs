import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: 'e2e',
    testMatch: '*.spec.mjs',
    timeout: 90_000,
    workers: 1,
    reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e/report' }]],
    outputDir: 'test-results',
    use: {
        baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4310',
        browserName: 'chromium',
        launchOptions: { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }
    }
});

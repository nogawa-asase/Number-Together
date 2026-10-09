import { defineConfig, devices } from '@playwright/test';

// E2Eテスト(npm run test:e2e)。E2E 用にビルドした dist-e2e/(エミュレータにつなぎ、1周10秒)を配信する
// (docs/architecture.md「E2Eテスト」)。どのテストも、同じエミュレータのデータベースを使うので、1つずつ動かす
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // CI では、タイミングによる失敗を1回だけ再実行する(docs/development-guidelines.md)
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    locale: 'ja-JP',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npx vite preview --outDir dist-e2e --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    // すべてのシナリオは Chromium で。ほかのブラウザ・スマホは、一連の流れとスマホ幅だけ(時間のため)
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: '**/full-round.spec.ts',
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testMatch: '**/full-round.spec.ts',
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
      testMatch: ['**/full-round.spec.ts', '**/mobile.spec.ts'],
    },
    {
      name: 'mobile-webkit',
      use: { ...devices['iPhone 14'] },
      testMatch: ['**/full-round.spec.ts', '**/mobile.spec.ts'],
    },
  ],
});

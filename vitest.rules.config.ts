import { defineConfig } from 'vitest/config';

// データベースのセキュリティルールのテスト(npm run test:rules)
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.rules.test.ts'],
    passWithNoTests: true,
    testTimeout: 30_000,
    fileParallelism: false,
  },
});

import { defineConfig } from 'vitest/config';

// シミュレーション(npm run test:sim)。時間がかかるので、npm test とは分ける
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/sim/**/*.sim.test.ts'],
    passWithNoTests: true,
    testTimeout: 120_000,
  },
});

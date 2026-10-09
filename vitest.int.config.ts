import { defineConfig } from 'vitest/config';

// Firebase Emulator Suite を使った結合テスト(npm run test:int)
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/int/**/*.int.test.ts'],
    passWithNoTests: true,
    testTimeout: 30_000,
    // 同じエミュレータを使うので、ファイルを並べて動かさない
    fileParallelism: false,
  },
});

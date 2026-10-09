import { defineConfig } from 'vitest/config';

// ユニットテスト(npm test)。ルール・結合・シミュレーション・E2E は、別の設定で動かす
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/domain/**/*.ts',
        'src/infra/memory/**/*.ts',
        'src/infra/timer/**/*.ts',
        'src/infra/prefs.ts',
        // Firebase の部分は、純粋な関数だけ(ほかは、結合テストで確かめる)
        'src/infra/firebase/paths.ts',
        'src/infra/firebase/parse.ts',
        'src/infra/firebase/errors.ts',
        'src/infra/firebase/TrafficMeter.ts',
        'src/app/**/*.ts',
      ],
      exclude: ['src/domain/**/types.ts'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});

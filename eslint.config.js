import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

// 層の依存ルール(docs/architecture.md「層のルールの強制」、
// docs/repository-structure.md「依存関係のルール」)
const FIREBASE_IMPORTS = {
  // パッケージ名だけに合わせる(相対パスの infra/firebase/ には合わせない)
  regex: '^@?firebase(/|$)',
  message: 'Firebase を import してよいのは src/infra/firebase/ だけです',
};

const layerImports = (patterns) => [
  'error',
  { patterns: [FIREBASE_IMPORTS, ...patterns] },
];

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSEnumDeclaration',
          message: 'enum ではなく、文字列リテラルの合併型を使ってください',
        },
      ],
    },
  },
  {
    // ドメイン層: 画面にも Firebase にもブラウザにも依存しない純粋な計算
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': layerImports([
        {
          group: ['**/app', '**/app/**', '**/ui', '**/ui/**'],
          message: 'ドメイン層から、アプリケーション層・UI層は使えません',
        },
        {
          group: ['**/infra', '**/infra/**'],
          message: 'ドメイン層から、インフラ層は使えません',
        },
      ]),
      'no-restricted-globals': [
        'error',
        ...[
          'window',
          'document',
          'navigator',
          'localStorage',
          'sessionStorage',
          'setTimeout',
          'setInterval',
          'clearTimeout',
          'clearInterval',
          'requestAnimationFrame',
          'performance',
        ].map((name) => ({
          name,
          message:
            'ドメイン層では、ブラウザの機能やタイマーを使えません(時刻と乱数は引数で受け取る)',
        })),
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: '乱数は Random を引数で受け取ってください',
        },
        {
          object: 'Date',
          property: 'now',
          message: '時刻は引数で受け取ってください(ServerClock.now())',
        },
      ],
    },
  },
  {
    // アプリケーション層: UI層は GameView を通し、インフラ層は実装ではなくインターフェースだけを使う
    files: ['src/app/**/*.ts'],
    rules: {
      'no-restricted-imports': layerImports([
        {
          group: ['**/ui', '**/ui/**'],
          message: 'アプリケーション層から UI層は使えません(GameView を通す)',
        },
        {
          group: ['**/infra/firebase/**', '**/infra/memory/**'],
          message:
            'インフラ層の実装ではなく、インターフェース(infra/store)を使ってください',
        },
      ]),
    },
  },
  {
    // UI層: インフラ層と Firebase は使えない
    files: ['src/ui/**/*.ts'],
    rules: {
      'no-restricted-imports': layerImports([
        {
          group: ['**/infra', '**/infra/**'],
          message: 'UI層から、インフラ層は使えません',
        },
      ]),
    },
  },
  {
    // インフラ層: アプリケーション層・UI層は使えない。Firebase は infra/firebase/ だけ
    files: ['src/infra/**/*.ts'],
    ignores: ['src/infra/firebase/**/*.ts'],
    rules: {
      'no-restricted-imports': layerImports([
        {
          group: ['**/app', '**/app/**', '**/ui', '**/ui/**'],
          message: 'インフラ層から、アプリケーション層・UI層は使えません',
        },
      ]),
    },
  },
  {
    files: ['src/infra/firebase/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/app', '**/app/**', '**/ui', '**/ui/**'],
              message: 'インフラ層から、アプリケーション層・UI層は使えません',
            },
          ],
        },
      ],
    },
  },
  {
    // 開発用スクリプト: ファイルを扱うだけで、ゲームのコードを使わない
    files: ['scripts/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/src', '**/src/**'],
              message: 'スクリプトから src/ は使えません',
            },
          ],
        },
      ],
    },
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'release/**',
      'emulator-data/**',
      'test-results/**',
      'playwright-report/**',
      '.steering/**',
      'docs/design/**',
    ],
  }
);

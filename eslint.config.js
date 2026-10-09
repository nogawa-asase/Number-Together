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

// 相対パスで、決めたディレクトリを指す import だけに合わせる正規表現
// (group の '**/app' は、パッケージ名の 'firebase/app' にも合ってしまうため)
const relativeTo = (...dirs) => `^(\\.\\./)+(${dirs.join('|')})(/|$)`;

const DOMAIN_LAYER_PATTERNS = [
  {
    regex: relativeTo('app', 'ui'),
    message: 'ドメイン層から、アプリケーション層・UI層は使えません',
  },
  {
    regex: relativeTo('infra'),
    message: 'ドメイン層から、インフラ層は使えません',
  },
];

// ドメイン層の分野ごとに、依存してよい分野(docs/repository-structure.md「モジュール間の依存」)。
// 型だけの依存も含める。domain/types.ts と domain/errors.ts は、どの分野も使ってよい
const DOMAIN_MODULE_DEPS = {
  config: [],
  schedule: ['config'],
  targets: ['config'],
  judge: ['targets', 'config'],
  points: ['targets', 'schedule', 'config'],
  pulses: ['config'],
  ranking: ['config'],
  titles: ['config'],
  names: ['config'],
  rooms: ['schedule', 'config'],
  ai: ['targets', 'schedule', 'config'],
  layout: ['schedule', 'config'],
};

// 分野ごとに、決めた向き以外の分野への相対 import を禁じる設定を作る。
// flat config では、後の設定の同じ規則が前を上書きするので、層の規則も含める
const domainModuleConfigs = Object.entries(DOMAIN_MODULE_DEPS).map(
  ([module, deps]) => {
    const forbidden = Object.keys(DOMAIN_MODULE_DEPS).filter(
      (other) => other !== module && !deps.includes(other)
    );
    return {
      files: [`src/domain/${module}/**/*.ts`],
      rules: {
        'no-restricted-imports': layerImports([
          ...DOMAIN_LAYER_PATTERNS,
          {
            regex: relativeTo(...forbidden),
            message: `domain/${module}/ が依存してよい分野は ${deps.join('・') || 'なし'} だけです(docs/repository-structure.md「モジュール間の依存」)`,
          },
        ]),
      },
    };
  }
);

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
      'no-restricted-imports': layerImports(DOMAIN_LAYER_PATTERNS),
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
  ...domainModuleConfigs,
  {
    // アプリケーション層: UI層は GameView を通し、インフラ層は実装ではなくインターフェースだけを使う
    files: ['src/app/**/*.ts'],
    rules: {
      'no-restricted-imports': layerImports([
        {
          regex: relativeTo('ui'),
          message: 'アプリケーション層から UI層は使えません(GameView を通す)',
        },
        {
          regex: relativeTo('infra/firebase', 'infra/memory', 'infra/timer'),
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
          regex: relativeTo('infra'),
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
          regex: relativeTo('app', 'ui'),
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
              regex: relativeTo('app', 'ui'),
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
              regex: relativeTo('src'),
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

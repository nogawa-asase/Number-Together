# Number Together

見えない誰かと、ひとつの数字をぴったり合わせる、みんなで遊ぶブラウザゲーム。itch.io で公開する。

- 何を作るか: `docs/product-requirements.md`
- どう動くか: `docs/functional-design.md`
- 何で作るか: `docs/architecture.md`
- 開発の進め方: `docs/development-guidelines.md`

このリポジトリは、書籍[「実践Claude Code入門 - 現場で活用するためのAIコーディングの思考法」](https://www.amazon.co.jp/dp/4297153548)の第8章のテンプレート([GenerativeAgents/claude-code-book](https://github.com/GenerativeAgents/claude-code-book))をもとにしている。

## セットアップ

VS Code の「Reopen in Container」で開くと、Node.js(LTS)・Java(Emulator Suite 用)・GitHub CLI・Claude Code が入り、`npm install` と Playwright のブラウザの導入が自動で行われる(Docker が必要)。

```bash
cp .env.example .env.local     # エミュレータだけで開発するなら、値は仮のままでよい
npm run emulators              # 1つ目の端末: Firebase Emulator Suite(画面は http://localhost:4000)
VITE_USE_EMULATOR=true npm run dev   # 2つ目の端末: 開発サーバー
```

本番の Firebase プロジェクトの準備は `docs/firebase-setup.md` を参照(開発者が自分で行う作業)。

## コマンド

| コマンド | 内容 |
|----------|------|
| `npm run dev` | 開発サーバー |
| `npm run build` | 型チェックと、`dist/` へのビルド |
| `npm run check:size` | 配信サイズの確認 |
| `npm run package:itch` | itch.io 用の zip(`release/`)を作る |
| `npm run lint` / `npm run typecheck` | 静的解析 / 型チェック |
| `npm test` | ユニットテスト |
| `npm run test:coverage` | カバレッジ付きのユニットテスト(ドメイン層80%以上) |
| `npm run test:rules` | セキュリティルールのテスト(Java が必要) |
| `npm run test:int` | Emulator Suite を使った結合テスト(Java が必要) |
| `npm run test:sim` | AIだけの回のシミュレーション |
| `npm run test:e2e` | E2Eテスト(Playwright。Java が必要) |

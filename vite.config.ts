import { defineConfig } from 'vite';

// itch.io は、ゲームを任意のパスの下で配信するので、すべて相対パスで参照する
// (docs/architecture.md「デプロイ(itch.io)」)
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});

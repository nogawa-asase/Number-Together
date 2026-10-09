/**
 * アプリの起動。各層を組み立てて、アプリを開始する。
 *
 * いまは、開発基盤だけを用意した段階なので、組み立てるものはない。
 * GameStore・ServerClock・コントローラー・画面ができたら、ここで結びつける
 * (docs/repository-structure.md「main.ts」)。
 */
function main(): void {
  const root = document.querySelector<HTMLDivElement>('#app');
  if (root === null) {
    throw new Error('#app が見つかりません');
  }
}

main();

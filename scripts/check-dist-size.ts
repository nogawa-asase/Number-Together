/**
 * ビルド結果(dist/)の配信サイズを確かめる。上限を超えたら、終了コード1で失敗する。
 *
 * 上限は docs/architecture.md「リソース使用量」と同じ値(仮)。最初のビルドで測ったあと、
 * ドキュメントと、この定数を、同じコミットで確定する。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST_DIR = 'dist';
const MAX_DIST_BYTES = 1024 * 1024; // dist/ の合計 1MB
const MAX_JS_GZIP_BYTES = 300 * 1024; // JavaScript の gzip 後の合計 300KB

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function main(): number {
  let files: string[];
  try {
    files = listFiles(DIST_DIR);
  } catch {
    console.error(
      `${DIST_DIR}/ がありません。先に npm run build を実行してください`
    );
    return 1;
  }

  const totalBytes = files.reduce((sum, file) => sum + statSync(file).size, 0);
  const jsGzipBytes = files
    .filter((file) => file.endsWith('.js'))
    .reduce((sum, file) => sum + gzipSync(readFileSync(file)).length, 0);

  for (const file of files) {
    console.log(
      `  ${relative(DIST_DIR, file)}: ${formatKb(statSync(file).size)}`
    );
  }
  console.log(
    `合計: ${formatKb(totalBytes)}(上限 ${formatKb(MAX_DIST_BYTES)})`
  );
  console.log(
    `JavaScript(gzip 後): ${formatKb(jsGzipBytes)}(上限 ${formatKb(MAX_JS_GZIP_BYTES)})`
  );

  if (totalBytes > MAX_DIST_BYTES || jsGzipBytes > MAX_JS_GZIP_BYTES) {
    console.error('配信サイズが上限を超えました');
    return 1;
  }
  return 0;
}

process.exitCode = main();

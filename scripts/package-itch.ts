/**
 * dist/ の中身を、itch.io にアップロードする zip にまとめる。
 *
 * itch.io は、zip の直下の index.html をゲームの入口として扱うので、dist/ フォルダ自体は含めない
 * (docs/architecture.md「デプロイ(itch.io)」)。zip の作成には、システムの zip コマンドを使う。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST_DIR = 'dist';
const RELEASE_DIR = 'release';

function main(): number {
  const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as {
    version: string;
  };

  execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });

  if (!existsSync(resolve(DIST_DIR, 'index.html'))) {
    console.error(`${DIST_DIR}/index.html がありません`);
    return 1;
  }

  mkdirSync(RELEASE_DIR, { recursive: true });
  const zipPath = resolve(RELEASE_DIR, `number-together-v${version}.zip`);
  rmSync(zipPath, { force: true });

  // dist/ の中に入ってから zip にする(zip の直下に index.html が来るように)
  execFileSync('zip', ['-r', '-q', zipPath, '.'], {
    cwd: DIST_DIR,
    stdio: 'inherit',
  });

  console.log(`作成しました: ${zipPath}`);
  return 0;
}

process.exitCode = main();

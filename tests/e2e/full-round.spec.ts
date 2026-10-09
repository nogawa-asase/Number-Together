import { expect, register, screens, test } from './support';

test('初回の登録 → 集合中 → スタート → プレイ → 結果発表 → 次の集合中', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));

  // 初回の登録(名前とキャラクター選び)
  await register(page, 'たろう');

  // 集合中(いまの回の途中なら、待機か、その回に途中参加。どちらでも、次の集合中には入る)
  await expect(page.locator(screens.lobby)).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.lobby .cell.me')).toContainText('たろう');

  // スタート → プレイ。押すと、自分のポイントが増える
  await expect(page.locator(screens.play)).toBeVisible();
  const plus = page.locator(screens.plus);
  await expect(plus).toBeEnabled();
  for (let i = 0; i < 5; i++) {
    await plus.click();
  }
  await expect(page.locator('.points-board [data-ref=points]')).not.toHaveText(
    '0'
  );

  // 結果発表: 最終の数字と、みんなのポイント(自分とAI4人)
  await expect(page.locator(screens.result)).toBeVisible();
  await expect(page.locator('.result-final [data-ref=final]')).not.toBeEmpty();
  await expect(page.locator('.rank-row')).toHaveCount(5);
  await expect(page.locator('.rank-row.me')).toContainText('たろう');

  // 次の集合中
  await expect(page.locator(screens.lobby)).toBeVisible();
  expect(errors).toEqual([]);
});

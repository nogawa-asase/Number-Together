import { writeAsOwner } from '../support/emulator';
import { waitFor } from '../support/testCycle';
import { decide, expect, openSetup, screens, test } from './support';

test('終了の間際に来たら、待機(終了間際)になり、次の回の集合で入る', async ({
  page,
}) => {
  await openSetup(page, 'たろう');
  await waitFor('grace', 200); // 終了の1分前(短い周期では1秒前)を過ぎてから決める
  await decide(page);
  await expect(page.locator('.wait-card')).toBeVisible();
  await expect(page.locator('.title')).toHaveText('もうすぐ終わるよ');
  await expect(page.locator(screens.lobby)).toBeVisible();
});

test('ゲーム中に全部の部屋が満員なら、待機(満員)になり、次の回の集合で入る', async ({
  page,
}) => {
  // Given: 部屋1が満員
  await writeAsOwner('roomCount', 1);
  await writeAsOwner('rooms/1/memberCount', 20);
  await openSetup(page, 'たろう');

  // When: ゲーム中に入ろうとする
  await waitFor('playing', 3_000);
  await decide(page);

  // Then
  await expect(page.locator('.title')).toHaveText('いまは満員だよ');
  await expect(page.locator(screens.lobby)).toBeVisible();
});

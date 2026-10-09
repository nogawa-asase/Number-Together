import { expect, register, screens, test } from './support';

test('ゲーム中に人が入ると、目標UPの吹き出しが出て、小人が降りてくる', async ({
  browser,
}) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();

  // Given: a が、ゲームを始めている(次のゲームの開始を待つ)
  await register(a, 'あき');
  await expect(a.locator(screens.lobby)).toBeVisible({ timeout: 20_000 });
  await b.goto('/'); // b は、先に開いておく(登録は、ゲームが始まってから)
  await b.locator('#setup-name').fill('ばん');
  await expect(a.locator(screens.play)).toBeVisible();

  // When: ゲーム中に、b が入る
  await b.locator('[data-ref=decide]').click();

  // Then: a の画面に、目標UPと召喚。b は、途中から遊べる
  await expect(a.locator('.target-up')).toBeVisible({ timeout: 5_000 });
  await expect(a.locator('.avatar.summoning')).toHaveCount(1);
  await expect(b.locator(screens.play)).toBeVisible();
});

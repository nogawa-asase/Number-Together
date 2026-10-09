import { expect, register, screens, test } from './support';

test('通信が切れると、再接続の画面が出て、つながると部屋に戻る', async ({
  page,
  context,
}) => {
  // Given: 部屋に入っている
  await register(page, 'たろう');
  await expect(
    page.locator(`${screens.lobby}, ${screens.play}, ${screens.result}`).first()
  ).toBeVisible();

  // When: 通信が切れる
  await context.setOffline(true);

  // Then: 3秒ほどで、再接続の画面
  await expect(page.locator('.offline-icon')).toBeVisible({ timeout: 20_000 });

  // When: つながる
  await context.setOffline(false);

  // Then: 部屋に戻る(続きから、または次の回から)
  await expect(page.locator('.offline-icon')).toBeHidden({ timeout: 30_000 });
});

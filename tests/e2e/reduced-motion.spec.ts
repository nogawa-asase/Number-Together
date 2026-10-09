import { expect, register, screens, test } from './support';

test('端末の「動きを減らす」設定で、動きがやむ', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await register(page, 'たろう');
  await expect(page.locator('html')).toHaveClass(/reduce-motion/);
  await expect(page.locator(screens.lobby)).toBeVisible({ timeout: 20_000 });
  const animation = await page
    .locator('.lobby .cell .bob')
    .first()
    .evaluate((el) => getComputedStyle(el).animationName);
  expect(animation).toBe('none');
});

test('自分の画面の「動きをへらす」スイッチでも、動きがやむ。次に開いたときも覚えている', async ({
  page,
}) => {
  await register(page, 'たろう');
  await expect(page.locator('html')).not.toHaveClass(/reduce-motion/);
  await page.locator('.top-buttons .lang-switch').first().click(); // じぶん
  await page.locator('.me [data-ref=switch]').click();
  await expect(page.locator('html')).toHaveClass(/reduce-motion/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/reduce-motion/);
});

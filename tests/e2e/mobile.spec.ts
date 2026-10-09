import {
  expect,
  noHorizontalOverflow,
  register,
  screens,
  test,
} from './support';

test.use({ viewport: { width: 360, height: 740 }, hasTouch: true });

test('スマホ幅(360px)で、横にはみ出さず、タップで押せる', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#setup-name')).toBeVisible();
  expect(await noHorizontalOverflow(page)).toBe(true);

  await register(page, 'たろう');
  await expect(page.locator(screens.lobby)).toBeVisible({ timeout: 20_000 });
  expect(await noHorizontalOverflow(page)).toBe(true);

  await expect(page.locator(screens.play)).toBeVisible();
  expect(await noHorizontalOverflow(page)).toBe(true);
  const plus = page.locator(screens.plus);
  await expect(plus).toBeEnabled();
  await plus.tap();
  await plus.tap();
  await expect(page.locator('.points-board [data-ref=points]')).not.toHaveText(
    '0'
  );
});

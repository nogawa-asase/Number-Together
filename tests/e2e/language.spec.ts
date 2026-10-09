import type { Page } from '@playwright/test';
import { expect, register, screens, test } from './support';

/** 文字が枠からはみ出している要素(見出し・ボタン・札・吹き出し) */
async function overflowing(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        '.title, .lead, .btn, .chip-dark, .title-chip, .range-chip, .pill, .note, .label, .lang-switch'
      ),
    ]
      .filter(
        (el) => el.offsetParent !== null && el.scrollWidth > el.clientWidth + 1
      )
      .map((el) => `${el.className}: ${el.textContent ?? ''}`)
  );
}

test('英語に切り替えると、文言が変わり、文字がはみ出さない。次に開いたときも英語', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.title')).toHaveText('はじめまして!');
  await page.locator('.lang-switch').last().click();
  await expect(page.locator('.title')).toHaveText('Welcome!');
  expect(await overflowing(page)).toEqual([]);

  await page.reload();
  await expect(page.locator('.title')).toHaveText('Welcome!');

  await register(page, 'Taro');
  await expect(page.locator(screens.lobby)).toBeVisible({ timeout: 20_000 });
  expect(await overflowing(page)).toEqual([]);
  await expect(page.locator(screens.play)).toBeVisible();
  expect(await overflowing(page)).toEqual([]);
  await expect(page.locator(screens.result)).toBeVisible();
  expect(await overflowing(page)).toEqual([]);

  // 日本語に戻す
  await page.locator('.lang-switch').last().click();
  await expect(page.locator('.result-final .label')).toHaveText('最終の数字');
});

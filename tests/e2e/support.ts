import { expect, type Page, test as base } from '@playwright/test';
import { resetEmulator } from '../support/emulator';

/** どのテストも、始める前に、エミュレータのデータベースと利用者を空にする(短い周期のルールも読み込ませる) */
export const test = base.extend<{ cleanEmulator: void }>({
  cleanEmulator: [
    // Playwright のフィクスチャは、引数を分割代入で受け取る決まり(使うものがなくても)
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      await resetEmulator();
      await use();
    },
    { auto: true },
  ],
});

export { expect };

/** 初めて開いて、名前を入れる(まだ決めない) */
export async function openSetup(page: Page, name: string): Promise<void> {
  await page.goto('/');
  await page.locator('#setup-name').fill(name);
}

/** 名前を決めて、登録する */
export async function decide(page: Page): Promise<void> {
  await page.locator('[data-ref=decide]').click();
}

/** 初めて開いて、登録する */
export async function register(page: Page, name: string): Promise<void> {
  await openSetup(page, name);
  await decide(page);
}

/** 画面の部品(部屋の中) */
export const screens = {
  lobby: '.screen.lobby',
  play: '.screen.play',
  result: '.screen.result',
  plus: '.screen.play [data-ref=plus]',
};

/** 横にはみ出していないか(スクロールできる幅が、画面の幅を超えていないか) */
export async function noHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth
  );
}

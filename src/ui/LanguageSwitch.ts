import { getLang, onLangChange, setLang, t } from '../app/i18n/i18n';
import { html } from './dom';

/**
 * 言語の切り替えボタン(どの画面でも右上)。切り替えた先の言語名を出す
 * (今が日本語なら「English」、今が英語なら「日本語」)。
 */
export function createLanguageSwitch(): HTMLButtonElement {
  const button = html<HTMLButtonElement>(
    '<button type="button" class="lang-switch"></button>'
  );
  const label = () => {
    button.textContent = t('lang.switch');
  };
  label();
  onLangChange(label);
  button.addEventListener('click', () => {
    setLang(getLang() === 'ja' ? 'en' : 'ja');
  });
  return button;
}

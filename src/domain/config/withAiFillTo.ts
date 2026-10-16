import type { GameConfig } from './types';

/**
 * 試験用に、AIで埋める人数(aiFillTo)を変えた設定を返す(VITE_AI_FILL_TO。20人の様子を試すときなど)。
 *
 * 値が 0〜roomCapacity の整数の文字列でなければ、設定は変えず、null を返す(呼ぶ側が警告を出す)。
 * 値がないとき(undefined・空)は、そのまま返す。
 *
 * @param config - もとの設定値
 * @param value - 環境変数の値
 * @returns 変えた設定。値が不正なら null
 */
export function withAiFillTo(
  config: GameConfig,
  value: string | undefined
): GameConfig | null {
  if (value === undefined || value === '') {
    return config;
  }
  if (!/^\d+$/.test(value)) {
    return null;
  }
  const aiFillTo = Number(value);
  if (aiFillTo > config.roomCapacity) {
    return null;
  }
  return { ...config, aiFillTo };
}

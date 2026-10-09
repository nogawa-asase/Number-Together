import type { Random } from '../ai/random';
import type {
  AccessoryId,
  CharacterSpec,
  HairId,
  ShirtColorId,
} from '../types';

/** 髪型(画面の見本 01 の順。PRDの未決定事項。仮) */
export const HAIRS: readonly HairId[] = [
  'short',
  'spiky',
  'long',
  'ponytail',
  'bun',
];

/** 服の色(画面の見本 01 の順) */
export const SHIRT_COLORS: readonly ShirtColorId[] = [
  'pink',
  'red',
  'orange',
  'yellow',
  'green',
  'cyan',
  'blue',
  'purple',
];

/** 小物(画面の見本 01 の順。なしを含む。仮) */
export const ACCESSORIES: readonly AccessoryId[] = [
  'none',
  'glasses',
  'cap',
  'ribbon',
  'headphones',
];

/** 最初に選ばれている見た目 */
export const DEFAULT_CHARACTER: CharacterSpec = {
  hair: 'ponytail',
  shirtColor: 'pink',
  accessory: 'none',
};

function pick<T>(list: readonly T[], random: Random): T {
  return list[Math.floor(random.next() * list.length)]!;
}

/**
 * 「おまかせ」の見た目を選ぶ。
 *
 * @param random - 乱数
 */
export function randomCharacter(random: Random): CharacterSpec {
  return {
    hair: pick(HAIRS, random),
    shirtColor: pick(SHIRT_COLORS, random),
    accessory: pick(ACCESSORIES, random),
  };
}

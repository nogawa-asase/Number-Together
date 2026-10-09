import type {
  AccessoryId,
  CharacterSpec,
  HairId,
  ShirtColorId,
} from '../../domain/types';

/** 服の色(画面の見本 01 の順) */
export const SHIRT_HEX: Readonly<Record<ShirtColorId, string>> = {
  pink: '#FF5C8A',
  red: '#FF3B5C',
  orange: '#FF9F1C',
  yellow: '#FFC400',
  green: '#2EC27E',
  cyan: '#00B8D9',
  blue: '#3A86FF',
  purple: '#9B5DE5',
};

// 髪と肌の色は選べない(見本 01 にない)。id から決める
const HAIR_COLORS = ['#3B2A20', '#111111', '#D94F30', '#E5B800'] as const;
const SKIN_COLORS = ['#FFD9B8', '#E8B58A', '#C98B5E'] as const;

/** 選択肢の見本で使う色(灰色の服・こげ茶の髪・明るい肌) */
export const SAMPLE_COLORS = {
  shirt: '#D5DCE4',
  hair: HAIR_COLORS[0],
  skin: SKIN_COLORS[0],
};

const INK = '#111111';

/** 文字列から、決まった小さな数を作る(同じ id なら、どの端末でも同じ色) */
function hashOf(id: string): number {
  let hash = 0;
  for (const char of id) {
    hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  }
  return hash;
}

/** id から、髪と肌の色を決める */
export function colorsFor(id: string): { hair: string; skin: string } {
  const hash = hashOf(id);
  return {
    hair: HAIR_COLORS[hash % HAIR_COLORS.length]!,
    skin: SKIN_COLORS[
      Math.floor(hash / HAIR_COLORS.length) % SKIN_COLORS.length
    ]!,
  };
}

const BODY = (fill: string) =>
  `<path d="M4 31 V25.5 Q4 19.5 11 19.5 Q18 19.5 18 25.5 V31 Z" fill="${fill}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;
const FACE = (skin: string) =>
  `<circle cx="11" cy="11.5" r="7" fill="${skin}" stroke="${INK}" stroke-width="2"/>` +
  `<circle cx="8.6" cy="12" r="1" fill="${INK}"/><circle cx="13.4" cy="12" r="1" fill="${INK}"/>`;
const SHORT = (hair: string) =>
  `<path d="M4 11 Q4 4 11 4 Q18 4 18 11 Q15.5 8 11 8.2 Q6.5 8 4 11 Z" fill="${hair}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`;

/** 髪型ごとの、体の後ろ(back)と、顔の前(front) */
const HAIR_PARTS: Readonly<
  Record<HairId, (hair: string) => { back: string; front: string }>
> = {
  short: (hair) => ({ back: '', front: SHORT(hair) }),
  spiky: (hair) => ({
    back: '',
    front: `<polygon points="4,11 3.5,4.5 7,6.5 8,1.5 11,5.2 14,1.5 15,6.5 18.5,4.5 18,11 15,8.2 11,9 7,8.2" fill="${hair}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`,
  }),
  long: (hair) => ({
    back: `<path d="M3.2 11 Q3.2 3.2 11 3.2 Q18.8 3.2 18.8 11 V18.5 H15 V12 H7 V18.5 H3.2 Z" fill="${hair}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`,
    front: `<path d="M4.8 10 Q11 5 17.2 10 Q11 7.6 4.8 10 Z" fill="${hair}" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`,
  }),
  ponytail: (hair) => ({
    back: `<circle cx="18.6" cy="15" r="3" fill="${hair}" stroke="${INK}" stroke-width="1.5"/>`,
    front: SHORT(hair),
  }),
  bun: (hair) => ({
    back: '',
    front:
      SHORT(hair) +
      `<circle cx="11" cy="3.4" r="3" fill="${hair}" stroke="${INK}" stroke-width="1.5"/>`,
  }),
};

/** 小物(髪の前に描く)。ぼうしは、髪の上をおおう */
const ACCESSORY_PARTS: Readonly<Record<AccessoryId, string>> = {
  none: '',
  glasses:
    `<circle cx="8.4" cy="12" r="2.3" fill="#FFFFFF" fill-opacity="0.6" stroke="${INK}" stroke-width="1.2"/>` +
    `<circle cx="13.6" cy="12" r="2.3" fill="#FFFFFF" fill-opacity="0.6" stroke="${INK}" stroke-width="1.2"/>` +
    `<line x1="10.7" y1="12" x2="11.3" y2="12" stroke="${INK}" stroke-width="1.2"/>`,
  cap:
    `<path d="M3.8 10 Q3.8 3.6 11 3.6 Q18.2 3.6 18.2 10 Z" fill="#FF3B5C" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path d="M10 9.6 H20.5 Q21.2 11.4 19.5 11.6 H10 Z" fill="#FF3B5C" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`,
  ribbon:
    `<polygon points="15.5,5 20.5,2.2 20.5,7.8" fill="#3A86FF" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<polygon points="15.5,5 10.8,2.2 10.8,7.8" fill="#3A86FF" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<circle cx="15.5" cy="5" r="1.2" fill="#3A86FF" stroke="${INK}" stroke-width="1"/>`,
  headphones:
    `<path d="M4 11 Q4 3.8 11 3.8 Q18 3.8 18 11" fill="none" stroke="${INK}" stroke-width="2"/>` +
    `<rect x="2.4" y="9.2" width="3.2" height="5" rx="1.2" fill="#FF3B5C" stroke="${INK}" stroke-width="1.2"/>` +
    `<rect x="16.4" y="9.2" width="3.2" height="5" rx="1.2" fill="#FF3B5C" stroke="${INK}" stroke-width="1.2"/>`,
};

/** 色を指定するとき(選択肢の見本) */
export interface CharacterColors {
  readonly shirt: string;
  readonly hair: string;
  readonly skin: string;
}

/**
 * 人間の小人の SVG(viewBox 0 0 22 32。見本 01・05・13 の形)。
 *
 * 他の人のデータは壊れていることがあるので、知らない部品は、既定の部品として描く
 * (文字列をそのまま HTML に入れない)。
 *
 * @param spec - 見た目
 * @param colors - 服・髪・肌の色
 * @param className - svg に付けるクラス
 */
export function characterSvg(
  spec: CharacterSpec,
  colors: CharacterColors,
  className = ''
): string {
  const hair = (HAIR_PARTS[spec.hair] ?? HAIR_PARTS.short)(colors.hair);
  const accessory = ACCESSORY_PARTS[spec.accessory] ?? '';
  const front = spec.accessory === 'cap' ? '' : hair.front; // ぼうしは髪をおおう
  return (
    `<svg viewBox="0 0 22 32" class="${className}" aria-hidden="true">` +
    hair.back +
    BODY(colors.shirt) +
    FACE(colors.skin) +
    front +
    accessory +
    '</svg>'
  );
}

/**
 * 参加者の小人の SVG(髪と肌の色は id から、服の色は見た目から)。
 *
 * @param id - 参加者の id(色を決める)
 * @param spec - 見た目
 * @param className - svg に付けるクラス
 */
export function playerSvg(
  id: string,
  spec: CharacterSpec,
  className = ''
): string {
  return characterSvg(
    spec,
    { ...colorsFor(id), shirt: SHIRT_HEX[spec.shirtColor] ?? SHIRT_HEX.pink },
    className
  );
}

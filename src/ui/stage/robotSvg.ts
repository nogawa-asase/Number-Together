import type { AiPersonality } from '../../domain/types';

/** 胸と頭のランプの色で、性格が分かる(見本 03: がめつい=赤、気まぐれ=青、調整役=緑) */
export const LAMP_COLORS: Readonly<Record<AiPersonality, string>> = {
  greedy: '#FF3B5C',
  moody: '#3A86FF',
  balancer: '#2EC27E',
  perfectionist: '#FFC400', // 見本にない(仮)
  lastSpurt: '#9B5DE5', // 見本にない(仮)
};

/** まだ性格の決まっていないAI(集合中の席)のランプ */
const UNKNOWN_LAMP = '#D5DCE4';

const BODY = '#9DB4C0';

/**
 * AIのロボットの SVG(viewBox 0 0 28 40。見本 03・05 の形)。
 *
 * @param personality - 性格。null なら、灰色のランプ(集合中の、まだ加わっていないAIの席)
 * @param className - svg に付けるクラス
 */
export function robotSvg(
  personality: AiPersonality | null,
  className = ''
): string {
  const lamp =
    (personality === null ? undefined : LAMP_COLORS[personality]) ??
    UNKNOWN_LAMP;
  return (
    `<svg viewBox="0 0 28 40" class="${className}" aria-hidden="true">` +
    '<line x1="14" y1="6" x2="14" y2="2" stroke="#111111" stroke-width="2"/>' +
    `<circle cx="14" cy="2.5" r="2" fill="${lamp}" stroke="#111111" stroke-width="1.5"/>` +
    `<rect x="4" y="6" width="20" height="14" rx="4" fill="${BODY}" stroke="#111111" stroke-width="2"/>` +
    '<rect x="8" y="11" width="4" height="4" fill="#111111"/><rect x="16" y="11" width="4" height="4" fill="#111111"/>' +
    `<rect x="6" y="21" width="16" height="15" rx="3" fill="${BODY}" stroke="#111111" stroke-width="2"/>` +
    `<circle cx="14" cy="28" r="2.8" fill="${lamp}" stroke="#111111" stroke-width="1.5"/>` +
    '<rect x="8" y="36" width="5" height="3" fill="#111111"/><rect x="15" y="36" width="5" height="3" fill="#111111"/>' +
    '</svg>'
  );
}

/** 集合中の札に添える、小さな白い線のロボット(見本 03) */
export function robotBadgeSvg(): string {
  return (
    '<svg viewBox="0 0 28 40" class="robot-badge" aria-hidden="true">' +
    '<line x1="14" y1="6" x2="14" y2="2" stroke="#FFFFFF" stroke-width="2.5"/>' +
    '<circle cx="14" cy="2.5" r="2.4" fill="#FF3B5C" stroke="#FFFFFF" stroke-width="1.5"/>' +
    `<rect x="4" y="6" width="20" height="14" rx="4" fill="${BODY}" stroke="#FFFFFF" stroke-width="2"/>` +
    '<rect x="8" y="11" width="4" height="4" fill="#111111"/><rect x="16" y="11" width="4" height="4" fill="#111111"/>' +
    `<rect x="6" y="21" width="16" height="15" rx="3" fill="${BODY}" stroke="#FFFFFF" stroke-width="2"/>` +
    '</svg>'
  );
}

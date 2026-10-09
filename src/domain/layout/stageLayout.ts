import { DomainError } from '../errors';
import type { StageMetrics } from './stageMetrics';

/** 小人1人分の位置 */
export interface StageSlot {
  readonly leftPx: number; // 舞台の左端から
  readonly bottomPx: number; // 舞台の下端から
  readonly depth: 'back' | 'front'; // 奥(偶数番目)か、手前(奇数番目)か
  readonly zIndex: number; // 重なる順。奥1・手前2・自分3
}

/** stageLayout の入力 */
export interface StageLayoutInput {
  readonly count: number; // 舞台に並べる人数(AIを含む)
  readonly myIndex: number | null; // 自分が何番目か(入った順)。見ているだけなら null
  readonly stageWidthPx: number; // 舞台の内側の幅(390px の画面で 308px)
}

/**
 * 小人を、入った順に1列に並べる位置を求める(docs/functional-design.md「10. 小人の舞台」)。
 *
 * 間隔は、舞台の幅に収まるように決め、人数が少ないときは maxPitchPx までにして、中央に寄せる。
 * 人数が多いときは、隣どうしが重なる(20人・幅308pxで、14.4px 間隔。体の約1/3ずつ重なる)。
 * 偶数番目は奥、奇数番目は手前に立ち、手前が奥の上に重なる。自分は、いちばん上。
 *
 * @param input - 人数、自分の番号、舞台の幅
 * @param metrics - 舞台の寸法
 * @returns 入った順の、各小人の位置
 * @throws DomainError - 人数が0以上の整数でない、自分の番号が範囲の外、舞台の幅が正でないとき
 */
export function stageLayout(
  input: StageLayoutInput,
  metrics: StageMetrics
): StageSlot[] {
  const { count, myIndex, stageWidthPx } = input;
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new DomainError(`人数が不正です: ${count}`);
  }
  if (
    myIndex !== null &&
    (!Number.isSafeInteger(myIndex) || myIndex < 0 || myIndex >= count)
  ) {
    throw new DomainError(`自分の番号が不正です: ${myIndex}`);
  }
  if (!(stageWidthPx > 0)) {
    throw new DomainError(`舞台の幅が不正です: ${stageWidthPx}`);
  }

  const { bodyWidthPx, edgePx, maxPitchPx } = metrics;
  const pitch =
    count <= 1
      ? 0
      : Math.min(
          maxPitchPx,
          (stageWidthPx - 2 * edgePx - bodyWidthPx) / (count - 1)
        );
  const span = bodyWidthPx + (count - 1) * pitch;
  const start = (stageWidthPx - span) / 2;

  return Array.from({ length: count }, (_, i) => {
    const depth = i % 2 === 0 ? 'back' : 'front';
    return {
      leftPx: start + i * pitch,
      bottomPx: depth === 'back' ? metrics.backBottomPx : metrics.frontBottomPx,
      depth,
      zIndex: i === myIndex ? 3 : depth === 'back' ? 1 : 2,
    };
  });
}

import type { GameConfig } from '../config/types';
import { DomainError } from '../errors';
import type { JoinVerdict } from '../schedule/types';
import type { Phase } from '../types';
import type { RoomPlan } from './types';

/**
 * 部屋ごとの人数のスナップショットから、入る先を決める(docs/functional-design.md「6. 部屋の割り振り」)。
 *
 * 部屋は、先着で埋める。新しい部屋を作るのは、集合中だけ(ゲーム中に、人もAIもいない状態から、
 * 途中で始まるのを避ける)。実際の入室は、Store の条件付きの書き込みで確定する。
 * 書き込みに負けたときは、呼ぶ側が、その部屋を満員として counts を直し、もう一度呼ぶ。
 *
 * @param counts - 部屋ごとの人間の人数。counts[i] は、部屋 i + 1(部屋の番号は1から)
 * @param phase - いまの段階
 * @param joinVerdict - canJoinNow の結果
 * @param config - 設定値(roomCapacity を使う)
 * @throws DomainError - counts に、0以上の整数でない値があるとき
 */
export function planRoom(
  counts: readonly number[],
  phase: Phase,
  joinVerdict: JoinVerdict,
  config: GameConfig
): RoomPlan {
  for (const count of counts) {
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new DomainError(`部屋の人数が不正です: ${count}`);
    }
  }

  if (!joinVerdict.ok) {
    return { kind: 'wait', reason: 'lastMinute' };
  }

  const index = counts.findIndex((count) => count < config.roomCapacity);
  if (index !== -1) {
    return { kind: 'enter', roomId: index + 1 };
  }

  return phase === 'gathering'
    ? { kind: 'create' }
    : { kind: 'wait', reason: 'full' };
}

import type { Player } from '../../../src/domain/types';

/** テスト用の人間の参加者。joinedAt は、指定しなければ0 */
export function humanOf(id: string, partial: Partial<Player> = {}): Player {
  return {
    id,
    kind: 'human',
    uid: id,
    name: id,
    character: { hair: 'short', shirtColor: 'red', accessory: 'none' },
    personality: null,
    joinedAt: 0,
    joinedDuring: 'gathering',
    ...partial,
  };
}

/** テスト用のAIの参加者 */
export function aiOf(id: string, partial: Partial<Player> = {}): Player {
  return {
    id,
    kind: 'ai',
    uid: null,
    name: '',
    character: null,
    personality: 'greedy',
    joinedAt: 0,
    joinedDuring: 'gathering',
    ...partial,
  };
}

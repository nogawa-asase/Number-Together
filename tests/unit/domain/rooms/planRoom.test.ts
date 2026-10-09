import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../../../src/domain/config/defaultConfig';
import { DomainError } from '../../../../src/domain/errors';
import { planRoom } from '../../../../src/domain/rooms/planRoom';
import type { JoinVerdict } from '../../../../src/domain/schedule/types';

const CAN_JOIN: JoinVerdict = { ok: true };
const LAST_MINUTE: JoinVerdict = { ok: false, reason: 'lastMinute' };

describe('planRoom', () => {
  describe('部屋の人数', () => {
    it('19人の部屋には、入れる', () => {
      expect(planRoom([19], 'playing', CAN_JOIN, DEFAULT_CONFIG)).toEqual({
        kind: 'enter',
        roomId: 1,
      });
    });

    it('20人の部屋は、満員', () => {
      expect(planRoom([20], 'playing', CAN_JOIN, DEFAULT_CONFIG)).toEqual({
        kind: 'wait',
        reason: 'full',
      });
    });

    it('21人の部屋(条件付きの書き込みの外で増えた場合)も、満員', () => {
      expect(planRoom([21], 'playing', CAN_JOIN, DEFAULT_CONFIG)).toEqual({
        kind: 'wait',
        reason: 'full',
      });
    });

    it('上限は、設定で変えられる', () => {
      const config = { ...DEFAULT_CONFIG, roomCapacity: 10 };
      expect(planRoom([10, 9], 'playing', CAN_JOIN, config)).toEqual({
        kind: 'enter',
        roomId: 2,
      });
    });
  });

  it('空きのある部屋のうち、最初の部屋(番号は1から)に入る', () => {
    expect(
      planRoom([20, 20, 3, 0], 'gathering', CAN_JOIN, DEFAULT_CONFIG)
    ).toEqual({ kind: 'enter', roomId: 3 });
  });

  it('人数の少ない部屋より、先の部屋を埋める(先着)', () => {
    expect(planRoom([15, 0], 'gathering', CAN_JOIN, DEFAULT_CONFIG)).toEqual({
      kind: 'enter',
      roomId: 1,
    });
  });

  describe('全部満員', () => {
    it('集合中は、新しい部屋を作る', () => {
      expect(planRoom([20, 20], 'gathering', CAN_JOIN, DEFAULT_CONFIG)).toEqual(
        { kind: 'create' }
      );
    });

    it('ゲーム中は、待つ', () => {
      expect(planRoom([20, 20], 'playing', CAN_JOIN, DEFAULT_CONFIG)).toEqual({
        kind: 'wait',
        reason: 'full',
      });
    });

    it('部屋が1つもなければ、集合中は作る', () => {
      expect(planRoom([], 'gathering', CAN_JOIN, DEFAULT_CONFIG)).toEqual({
        kind: 'create',
      });
    });

    it('部屋が1つもなければ、ゲーム中は待つ', () => {
      expect(planRoom([], 'playing', CAN_JOIN, DEFAULT_CONFIG)).toEqual({
        kind: 'wait',
        reason: 'full',
      });
    });
  });

  describe('途中参加の締め切り', () => {
    it('締め切りを過ぎたら、空きがあっても待つ', () => {
      expect(planRoom([3], 'playing', LAST_MINUTE, DEFAULT_CONFIG)).toEqual({
        kind: 'wait',
        reason: 'lastMinute',
      });
    });

    it('結果発表中は、待つ', () => {
      expect(planRoom([3], 'result', LAST_MINUTE, DEFAULT_CONFIG)).toEqual({
        kind: 'wait',
        reason: 'lastMinute',
      });
    });
  });

  it.each([-1, 1.5, Number.NaN])('人数が %s なら DomainError', (count) => {
    expect(() =>
      planRoom([0, count], 'gathering', CAN_JOIN, DEFAULT_CONFIG)
    ).toThrow(DomainError);
  });
});

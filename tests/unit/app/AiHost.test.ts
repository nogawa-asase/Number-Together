import { describe, expect, it, vi } from 'vitest';
import { AI_PERSONALITIES } from '../../../src/domain/ai/pickPersonalities';
import { advanceSettled, aiHostWorld, settle } from '../fixtures/app';
import {
  GRACE_END,
  PLAY_END,
  PLAY_START,
  ROUND,
  START,
} from '../fixtures/memoryStore';

const NEXT_ROUND = String(Number(ROUND) + 1);
const OLD_ROUND = String(Number(ROUND) - 2);

describe('AiHost: 担当の追従', () => {
  it('担当でないあいだは、何もしない', async () => {
    const w = await aiHostWorld(START, 2);
    const other = w.humans[1]!;
    const aiHost = w.aiHostOf(other);
    const add = vi.spyOn(other.store, 'addPlayer');
    const del = vi.spyOn(other.store, 'deleteRound');
    aiHost.start();
    w.clock.advance(60_000);
    await settle();

    expect(aiHost.isActive()).toBe(false);
    expect(add).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
    expect(w.ais()).toEqual([]);
  });

  it('担当が抜けたら、引き継いだ人が、同じAIの操作を続ける', async () => {
    const w = await aiHostWorld(START, 2);
    const [host, other] = [w.humans[0]!, w.humans[1]!];
    await w.join(host);
    await w.join(other);
    const first = w.aiHostOf(host);
    const second = w.aiHostOf(other);
    first.start();
    second.start();
    w.clock.advance(60_000);
    await settle();
    expect(first.isActive()).toBe(true);
    expect(w.ais()).toHaveLength(3);

    host.store.disconnect(); // 担当の参加中の印が消える
    expect(await other.store.claimAiHost(w.roomId, ROUND, other.uid)).toBe(
      true
    );
    expect(first.isActive()).toBe(false);
    expect(second.isActive()).toBe(true);

    const before = w.server.pulsesOf(w.roomId, ROUND);
    await advanceSettled(w.clock, 60_000);
    expect(w.ais()).toHaveLength(3); // 足さない
    const after = w.server.pulsesOf(w.roomId, ROUND);
    const resent = w.ais().filter((ai) => after[ai.id]!.t > before[ai.id]!.t);
    expect(resent.length).toBeGreaterThan(0);
  });

  it('引き継いだ人は、AIのポイントを0から数え直す。前の値より小さい間は、ルールで拒否され、前の値が残る', async () => {
    const w = await aiHostWorld(START, 2);
    const [host, other] = [w.humans[0]!, w.humans[1]!];
    await w.join(host);
    await w.join(other);
    w.aiHostOf(host).start();
    w.aiHostOf(other).start();
    await advanceSettled(w.clock, 120_000);
    // AIのポイント(テストなので、サーバーに、そのAIとして聞く)
    const aiPoints = () =>
      w.ais().map((ai) => w.server.readPoints(ai.id, w.roomId, ROUND)[ai.id]);
    const before = aiPoints();
    expect(before.every((p) => p! > 0)).toBe(true);

    host.store.disconnect();
    await other.store.claimAiHost(w.roomId, ROUND, other.uid);
    await advanceSettled(w.clock, GRACE_END - (START + 120_000));

    const after = aiPoints();
    after.forEach((p, i) => expect(p).toBeGreaterThanOrEqual(before[i]!));
    expect(w.server.rejections.length).toBeGreaterThan(0);
    for (const rejection of w.server.rejections) {
      expect(rejection).toEqual({
        uid: other.uid,
        action: 'writePoints',
        reason: '0以上の整数で、減らない',
      });
    }
  });

  it('stop の後は、担当でも何もしない。start・stop は2回呼んでもよい', async () => {
    const w = await aiHostWorld(START);
    await w.join(w.host);
    const aiHost = w.aiHostOf(w.host);
    aiHost.start();
    aiHost.start();
    expect(aiHost.isActive()).toBe(true);
    aiHost.stop();
    aiHost.stop();
    expect(aiHost.isActive()).toBe(false);
    w.clock.advance(60_000);
    await settle();
    expect(w.ais()).toEqual([]);
  });

  it('担当の値が同じまま、もう一度届いても、始め直さない', async () => {
    const w = await aiHostWorld(PLAY_START);
    await w.join(w.host);
    vi.spyOn(w.host.store, 'onAiHost').mockImplementation((_room, listener) => {
      listener(w.host.uid);
      listener(w.host.uid);
      return () => {};
    });
    const add = vi.spyOn(w.host.store, 'addPlayer');
    const aiHost = w.aiHostOf(w.host);
    aiHost.start();
    await settle();
    expect(add).toHaveBeenCalledTimes(4);
    aiHost.stop();
  });
});

describe('AiHost: AIの追加', () => {
  it('ゲーム開始の時刻に、人間が足りない数のAIが、性格を重ねずに加わる', async () => {
    const w = await aiHostWorld(START, 2);
    await w.join(w.humans[0]!);
    await w.join(w.humans[1]!);
    w.aiHostOf(w.host).start();
    w.clock.advance(PLAY_START - START - 1);
    expect(w.ais()).toEqual([]); // 集合中は、まだ足さない

    w.clock.advance(1);
    const ais = w.ais();
    expect(ais.map((ai) => ai.id)).toEqual(['ai-1', 'ai-2', 'ai-3']);
    expect(new Set(ais.map((ai) => ai.personality)).size).toBe(3);
    for (const ai of ais) {
      expect(AI_PERSONALITIES).toContain(ai.personality);
      expect(ai.joinedDuring).toBe('gathering');
      expect(ai.joinedAt).toBe(PLAY_START);
    }
  });

  it('人間が5人いれば、AIは加わらない', async () => {
    const w = await aiHostWorld(START, 5);
    for (const member of w.humans) {
      await w.join(member);
    }
    w.aiHostOf(w.host).start();
    w.clock.advance(60_000);
    await settle();
    expect(w.ais()).toEqual([]);
    expect(w.players()).toHaveLength(5);
  });

  it('ゲーム中に担当になり、AIがいなければ、その時点で足す。自分は、まだいなくても人間として数える', async () => {
    const w = await aiHostWorld(PLAY_START + 100_000);
    w.aiHostOf(w.host).start();
    const ais = w.ais();
    expect(ais).toHaveLength(4);
    for (const ai of ais) {
      expect(ai.joinedDuring).toBe('playing');
    }
    await w.join(w.host); // 自分は、あとから加わる
    expect(w.players()).toHaveLength(5);
  });

  it('結果発表中に担当になったら、次の回のゲーム開始まで待つ', async () => {
    const w = await aiHostWorld(PLAY_END + 5_000);
    const aiHost = w.aiHostOf(w.host);
    aiHost.start();
    expect(aiHost.isActive()).toBe(true);
    expect(w.ais(ROUND)).toEqual([]);

    w.clock.advance(START + 360_000 + 30_000 - (PLAY_END + 5_000));
    expect(w.ais(NEXT_ROUND)).toHaveLength(4);
    expect(w.ais(NEXT_ROUND)[0]!.joinedDuring).toBe('gathering');
  });

  it('性格が一覧にないAIは、受け持たない', async () => {
    const w = await aiHostWorld(PLAY_START);
    await w.join(w.host);
    const original = w.host.store.onPlayers.bind(w.host.store);
    vi.spyOn(w.host.store, 'onPlayers').mockImplementation(
      (room, round, listener) =>
        original(room, round, (players) =>
          listener([
            ...players,
            {
              ...players[0]!,
              id: 'ai-x',
              kind: 'ai',
              personality: 'boss' as never,
            },
          ])
        )
    );
    w.aiHostOf(w.host).start();
    w.clock.advance(30_000);
    await settle();
    const pulses = w.server.pulsesOf(w.roomId, ROUND);
    expect(pulses['ai-x']).toBeUndefined();
    expect(w.ais()).toHaveLength(0); // AIがいる(ように見えた)ので、足していない
    expect(w.onError).not.toHaveBeenCalled();
  });
});

describe('AiHost: 古い回の削除', () => {
  it('担当になったときと、回の始めに、roundsToKeep より古い回を消す', async () => {
    const w = await aiHostWorld(START);
    const del = vi.spyOn(w.host.store, 'deleteRound');
    await w.join(w.host);
    w.aiHostOf(w.host).start();
    expect(del).toHaveBeenLastCalledWith(w.roomId, OLD_ROUND);

    w.clock.advance(360_000); // 次の回の始め
    await w.join(w.host);
    expect(del).toHaveBeenLastCalledWith(w.roomId, String(Number(ROUND) - 1));
    expect(w.players(ROUND)).toHaveLength(5); // 1つ前の回は残る

    w.clock.advance(360_000); // その次の回の始め
    expect(del).toHaveBeenLastCalledWith(w.roomId, ROUND);
    expect(w.players(ROUND)).toEqual([]);
    expect(w.players(NEXT_ROUND)).toHaveLength(5);
    expect(w.server.rejections).toEqual([]);
  });

  it('回の番号が roundsToKeep より小さいときは、消さない', async () => {
    const w = await aiHostWorld(1_000);
    const del = vi.spyOn(w.host.store, 'deleteRound');
    w.aiHostOf(w.host).start();
    expect(del).not.toHaveBeenCalled();
  });
});

describe('AiHost: エラー', () => {
  it('追加・削除の StoreError(切断など)は無視し、それ以外は onError に伝える', async () => {
    const w = await aiHostWorld(PLAY_START);
    const aiHost = w.aiHostOf(w.host);
    const unexpected = new Error('想定外');
    const add = vi.spyOn(w.host.store, 'addPlayer');
    w.host.store.disconnect(); // 担当の値は、自分のまま
    aiHost.start();
    await settle();
    expect(add).toHaveBeenCalledTimes(4);
    expect(w.onError).not.toHaveBeenCalled(); // offline の StoreError だけ

    aiHost.stop();
    w.host.store.reconnect();
    vi.spyOn(w.host.store, 'deleteRound').mockRejectedValue(unexpected);
    vi.spyOn(w.host.store, 'addPlayer').mockRejectedValue(unexpected);
    aiHost.start();
    await settle();
    expect(w.onError).toHaveBeenCalledTimes(5); // 削除1回 + 追加4回(切断の分は数えない)
    expect(w.onError).toHaveBeenCalledWith(unexpected);
  });
});

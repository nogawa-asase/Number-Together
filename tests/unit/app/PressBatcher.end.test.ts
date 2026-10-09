import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../../../src/domain/config/defaultConfig';
import { StoreError } from '../../../src/infra/store/StoreError';
import { batcherWorld, settle } from '../fixtures/app';
import { PLAY_END } from '../fixtures/memoryStore';

describe('PressBatcher: 終わり', () => {
  it('ゲーム終了の後は、数字・合図を送らず、ポイントを最後に1回書く', async () => {
    const w = await batcherWorld(PLAY_END - 1_000);
    const add = vi.spyOn(w.me.store, 'addToNumber');
    const pulse = vi.spyOn(w.me.store, 'sendPulse');
    w.batcher.press('+1', 3);
    w.clock.advance(200);
    await settle();
    expect(add).toHaveBeenCalledTimes(1);

    w.clock.advance(700); // 終了の100ミリ秒前
    w.batcher.press('+1', 7); // この分の数字は、送る前に終了になる
    w.clock.advance(100); // 終了ちょうどの送信
    await settle();

    expect(add).toHaveBeenCalledTimes(1);
    expect(w.number()).toBe(1);
    expect(w.points()).toBe(7); // ポイントは、終了の3秒後まで書ける
    expect(w.batcher.pendingDelta()).toBe(0);
    expect(pulse).toHaveBeenCalledTimes(1); // 最初の押下の分だけ
  });

  it('終了の後に押しても、何も送らない', async () => {
    const w = await batcherWorld(PLAY_END - 200);
    w.clock.advance(200);
    const add = vi.spyOn(w.me.store, 'addToNumber');
    w.batcher.press('+1', 9);
    w.clock.advance(1_000);
    await settle();
    expect(add).not.toHaveBeenCalled();
    expect(w.batcher.pendingDelta()).toBe(0);
  });

  it('予約した合図が、終了の後になったら送らない', async () => {
    const w = await batcherWorld(PLAY_END - 500);
    const pulse = vi.spyOn(w.me.store, 'sendPulse');
    w.batcher.press('+1', 0);
    w.clock.advance(100);
    w.batcher.press('+1', 0); // 予約は 終了の500ミリ秒後
    w.clock.advance(2_000);
    expect(pulse).toHaveBeenCalledTimes(1);
  });

  it('送信より先に、予約した合図が終了の後に来ても、送らない', async () => {
    // 送信の間隔を長くして、終了の後の最初の送信より前に、合図の予約が来るようにする
    const config = { ...DEFAULT_CONFIG, batchMs: 5_000 };
    const w = await batcherWorld(PLAY_END - 500, config);
    const pulse = vi.spyOn(w.me.store, 'sendPulse');
    w.batcher.press('+1', 0);
    w.clock.advance(100);
    w.batcher.press('+1', 0); // 予約は 終了の500ミリ秒後。送信は 終了の4,500ミリ秒後
    w.clock.advance(1_000);
    expect(pulse).toHaveBeenCalledTimes(1);
  });

  it('stop の後は、何も送らない(ポイントも書かない)', async () => {
    const w = await batcherWorld();
    const write = vi.spyOn(w.me.store, 'writePoints');
    w.batcher.press('+1', 1);
    w.batcher.press('+1', 2);
    w.batcher.stop();
    w.batcher.stop(); // 2回呼んでもよい
    w.batcher.press('+1', 3);
    w.clock.advance(1_000);
    await settle();
    expect(w.number()).toBe(0);
    expect(write).not.toHaveBeenCalled();
    expect(w.batcher.pendingDelta()).toBe(0);
  });
});

describe('PressBatcher: 送れなかったとき', () => {
  it('切断中に送れなかった分は、つながったあとの送信に回る', async () => {
    const w = await batcherWorld();
    w.batcher.press('+1', 1);
    w.batcher.press('+1', 2);
    w.me.store.disconnect();
    w.clock.advance(200);
    await settle();
    expect(w.number()).toBe(0);
    expect(w.batcher.pendingDelta()).toBe(2);

    w.me.store.reconnect();
    w.clock.advance(200);
    await settle();
    expect(w.number()).toBe(2);
    expect(w.points()).toBe(2);
    expect(w.onError).not.toHaveBeenCalled();
  });

  it('ポイントを書けなかったら、次の送信で書き直す', async () => {
    const w = await batcherWorld();
    const write = vi
      .spyOn(w.me.store, 'writePoints')
      .mockRejectedValueOnce(new StoreError('offline', 'テスト'));
    w.batcher.press('+1', 4);
    w.clock.advance(200);
    await settle();
    w.clock.advance(200);
    await settle();
    expect(write).toHaveBeenCalledTimes(2);
    expect(w.points()).toBe(4);
  });

  it('合図を送れなくても、止まらない', async () => {
    const w = await batcherWorld();
    vi.spyOn(w.me.store, 'sendPulse').mockRejectedValueOnce(
      new StoreError('offline', 'テスト')
    );
    w.batcher.press('+1', 0);
    w.clock.advance(200);
    await settle();
    expect(w.number()).toBe(1);
    expect(w.onError).not.toHaveBeenCalled();
  });

  it('想定外のエラーは、onError に伝える', async () => {
    const w = await batcherWorld();
    const boom = new Error('boom');
    vi.spyOn(w.me.store, 'addToNumber').mockRejectedValueOnce(boom);
    w.batcher.press('+1', 0);
    w.clock.advance(200);
    await settle();
    expect(w.onError).toHaveBeenCalledWith(boom);
  });

  it('ポイントの書き込み中は、同じ値を重ねて書かない', async () => {
    const w = await batcherWorld();
    let resolveWrite: () => void = () => {};
    const write = vi
      .spyOn(w.me.store, 'writePoints')
      .mockImplementationOnce(
        () => new Promise<void>((resolve) => (resolveWrite = resolve))
      );
    w.batcher.press('+1', 1);
    w.clock.advance(400); // 書き込みが終わらないまま、2回目の送信
    await settle();
    expect(write).toHaveBeenCalledTimes(1);
    resolveWrite();
    await settle();
    w.clock.advance(200);
    await settle();
    expect(write).toHaveBeenCalledTimes(1); // 書けたので、もう書かない
  });
});

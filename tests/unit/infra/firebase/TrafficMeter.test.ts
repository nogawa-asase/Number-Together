import { describe, expect, it } from 'vitest';
import {
  bytesOf,
  createTrafficMeter,
  NO_TRAFFIC_METER,
} from '../../../../src/infra/firebase/TrafficMeter';

describe('TrafficMeter', () => {
  it('受け取った値・送った値の回数と、JSON にしたときのバイト数(UTF-8)を数え、report で数え直す', () => {
    const meter = createTrafficMeter();
    meter.countIn('a', { n: 1 });
    meter.countIn('a', 'あ');
    meter.countOut('b', 12);
    expect(meter.report('r1', 5)).toEqual({
      roundId: 'r1',
      playerCount: 5,
      inCount: 2,
      inBytes: bytesOf({ n: 1 }) + bytesOf('あ'),
      outCount: 1,
      outBytes: 2,
    });
    expect(meter.report('r2', 5)).toMatchObject({ inCount: 0, outBytes: 0 });
  });

  it('バイト数は UTF-8(日本語1文字は3バイト)。値がなければ null として数える', () => {
    expect(bytesOf('あ')).toBe(5); // "あ"
    expect(bytesOf(undefined)).toBe(4);
  });

  it('無効な計測は、何も数えない', () => {
    NO_TRAFFIC_METER.countIn('a', 1);
    NO_TRAFFIC_METER.countOut('a', 1);
    expect(NO_TRAFFIC_METER.report('r', 3)).toEqual({
      roundId: 'r',
      playerCount: 3,
      inCount: 0,
      inBytes: 0,
      outCount: 0,
      outBytes: 0,
    });
  });
});

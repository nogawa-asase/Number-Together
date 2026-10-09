/** その回の通信量の合計 */
export interface TrafficReport {
  readonly roundId: string;
  readonly playerCount: number;
  readonly inCount: number;
  readonly inBytes: number;
  readonly outCount: number;
  readonly outBytes: number;
}

/**
 * 通信量の計測(PRD機能9。docs/functional-design.md「TrafficMeter」)。
 *
 * 受け取った値・送った値の回数と、JSON にしたときのバイト数(UTF-8)を数える。
 * 実際の通信量(Firebase の管理画面のダウンロード量)とは、ずれる。テストプレイでは、両方を見比べる。
 */
export interface TrafficMeter {
  countIn(path: string, value: unknown): void;
  countOut(path: string, value: unknown): void;
  /** その回の合計を返し、数え直す */
  report(roundId: string, playerCount: number): TrafficReport;
}

const encoder = new TextEncoder();

/** 値を JSON にしたときのバイト数(UTF-8) */
export function bytesOf(value: unknown): number {
  return encoder.encode(JSON.stringify(value ?? null)).length;
}

/** 数える計測 */
export function createTrafficMeter(): TrafficMeter {
  let inCount = 0;
  let inBytes = 0;
  let outCount = 0;
  let outBytes = 0;
  return {
    countIn(_path, value) {
      inCount += 1;
      inBytes += bytesOf(value);
    },
    countOut(_path, value) {
      outCount += 1;
      outBytes += bytesOf(value);
    },
    report(roundId, playerCount) {
      const result = {
        roundId,
        playerCount,
        inCount,
        inBytes,
        outCount,
        outBytes,
      };
      inCount = inBytes = outCount = outBytes = 0;
      return result;
    },
  };
}

/** 何も数えない計測(VITE_TRAFFIC_METER=1 でないとき) */
export const NO_TRAFFIC_METER: TrafficMeter = {
  countIn: () => {},
  countOut: () => {},
  report: (roundId, playerCount) => ({
    roundId,
    playerCount,
    inCount: 0,
    inBytes: 0,
    outCount: 0,
    outBytes: 0,
  }),
};

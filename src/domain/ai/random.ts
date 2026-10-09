/** 乱数。テストやシミュレーションでは、種を固定したものに差し替える */
export interface Random {
  /** 0以上1未満の数を返す */
  next(): number;
}

/**
 * 種を固定できる疑似乱数を作る(mulberry32)。同じ種なら、同じ並びを返す。
 *
 * ドメイン層では Math.random を使わない(結果を再現できるようにするため)。
 * ブラウザでは、アプリケーション層が、時刻などから種を作って渡す。
 *
 * @param seed - 種(整数。32ビットに丸める)
 */
export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  return {
    next(): number {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
    },
  };
}

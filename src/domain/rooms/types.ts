/** 部屋の割り振りの判断 */
export type RoomPlan =
  | { readonly kind: 'enter'; readonly roomId: number } // この部屋に入る
  | { readonly kind: 'create' } // 新しい部屋を作って入る(集合中だけ)
  | { readonly kind: 'wait'; readonly reason: 'full' | 'lastMinute' };

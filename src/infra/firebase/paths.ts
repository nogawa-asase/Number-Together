/**
 * データベースのパス(docs/functional-design.md「データベースの配置」)。
 * パスの文字列は、ここ以外に書かない。
 */
export const paths = {
  profile: (uid: string) => `users/${uid}/profile`,
  stats: (uid: string) => `users/${uid}/stats`,
  roomCount: () => 'roomCount',
  memberCount: (roomId: number) => `rooms/${roomId}/memberCount`,
  presence: (roomId: number) => `rooms/${roomId}/presence`,
  presenceOf: (roomId: number, uid: string) =>
    `rooms/${roomId}/presence/${uid}`,
  aiHost: (roomId: number) => `rooms/${roomId}/aiHost`,
  round: (roomId: number, roundId: string) =>
    `rooms/${roomId}/rounds/${roundId}`,
  number: (roomId: number, roundId: string) =>
    `rooms/${roomId}/rounds/${roundId}/number`,
  players: (roomId: number, roundId: string) =>
    `rooms/${roomId}/rounds/${roundId}/players`,
  player: (roomId: number, roundId: string, playerId: string) =>
    `rooms/${roomId}/rounds/${roundId}/players/${playerId}`,
  pulses: (roomId: number, roundId: string) =>
    `rooms/${roomId}/rounds/${roundId}/pulses`,
  pulse: (roomId: number, roundId: string, playerId: string) =>
    `rooms/${roomId}/rounds/${roundId}/pulses/${playerId}`,
  points: (roomId: number, roundId: string, playerId: string) =>
    `rooms/${roomId}/rounds/${roundId}/points/${playerId}`,
  connected: () => '.info/connected',
  serverTimeOffset: () => '.info/serverTimeOffset',
};

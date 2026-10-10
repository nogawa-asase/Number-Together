# 開発ガイドライン (Development Guidelines)

このドキュメントは、`docs/architecture.md` と `docs/repository-structure.md` にもとづいて、コードの書き方と開発の進め方を定める。迷ったときは「ルールの判定をドメイン層の1か所に閉じ込め、テストで確かめる」ことと、「Firebase を触るのはインフラ層だけにする」ことを優先する。

## コーディング規約

### 基本方針

| 方針 | 理由 |
|------|------|
| ドメイン層は純粋な関数で書く | 同じコードを、ブラウザ・テスト・シミュレーションで使うため。AIの手や進行を、ネットワークなしで、速く何度も試せるようにするため |
| 時刻と乱数は、引数で受け取る | `Date.now` や `Math.random` を直接呼ぶと、テストで結果を固定できないため(時計は `ServerClock`、乱数は `Random`) |
| 状態は書き換えずに新しく作る(イミュータブル) | 状態の変更箇所を追いやすくするため。画面が見る `RoundView` を、データベースの値と時計から、毎回組み立てるため |
| 判定は必ずドメイン層に任せる | 画面の判定とAIの判断がずれないようにするため(UI層やアプリケーション層で、目標・範囲・ポイントの判定を書き直さない) |
| Firebase を触るのは、インフラ層だけ | ドメイン層とアプリケーション層を、Firebase なしで試せるようにするため。ESLint で強制する |
| 数値の決めごとには名前を付け、設定ファイルにまとめる | 目標・倍率・時間・人数など、遊びながら調整する値を、1か所(`domain/config/defaultConfig.ts`)で管理するため |

### 型定義

- `any` を使わない。型が分からない値は `unknown` で受けて、確かめてから使う。データベースから読んだ値は、必ず `unknown` として受け、形を検証してから、ドメインの型にする
- ドメインの型のプロパティには `readonly` を付け、配列は `readonly T[]` にする
- 取りうる値が決まっている文字列は、文字列リテラルの合併型で表す(`enum` は使わない)

```typescript
// ✅ 良い例
interface Player {
  readonly id: string;
  readonly kind: 'human' | 'ai';
  readonly uid: string | null;
  readonly joinedAt: number;
}

type Outcome = 'perfect' | 'success' | 'fail';

// ❌ 悪い例
interface Player {
  kind: string;        // 取りうる値が分からない
  members: any[];      // 何の配列か分からない
}
```

- 状態を変えるときは、スプレッド構文で新しいオブジェクトを作る

```typescript
// ✅ 良い例: 新しい値を返す
function addPoints(current: number, gain: number, cap: number | null): number {
  const next = current + gain;
  return cap === null ? next : Math.min(next, cap);
}

// ❌ 悪い例: 引数のオブジェクトを書き換える
function addPoints(player: { points: number }, gain: number): void {
  player.points += gain;
}
```

- **例外**: 数千回くり返す処理(AIのシミュレーションなど)の内部では、ローカル変数の書き換えを認める。関数の外から見て純粋(同じ入力に同じ出力、引数を書き換えない)であればよい

### 命名規則

#### 変数・関数・型

| 対象 | 規則 | 例 |
|------|------|-----|
| 変数・引数 | camelCase、名詞 | `playerCount`、`playEndsAt` |
| 関数 | camelCase、動詞で始める | `roundClockAt`、`pointsForPress`、`buildRanking` |
| 真偽値 | `is`・`has`・`can`・`will` で始める | `isInRange`、`canJoinNow`、`bonusActive` |
| 定数 | UPPER_SNAKE_CASE | `DEFAULT_CONFIG`、`MAX_DIST_BYTES` |
| 型・インターフェース・クラス | PascalCase、名詞。インターフェースに `I` を付けない | `RoundView`、`GameStore`、`RoundController` |
| 時刻・長さ | 単位を名前に入れる。時刻は `…At`、長さは `…Ms` | `playEndsAt`、`gatherMs` |

#### このプロジェクトの用語

コード上の名前は英語で書く。用語の定義と、日本語とコード上の名前の対応は `docs/glossary.md` を正とする。

下の表は、実装で取り違えやすい名前だけを抜き出した早見表。

| 日本語 | コード上の名前 |
|--------|---------------|
| 回(ラウンド) | `round`(番号は `roundIndex`、データベースのキーは `roundId`) |
| 段階(集合中・ゲーム中・結果発表) | `phase`(`'gathering'`・`'playing'`・`'result'`) |
| 部屋 | `room`(`roomId`) |
| プレイヤー(人間・AI) | `player`(`kind: 'human' | 'ai'`) |
| 共有の数字 | `number` |
| 目標・範囲 | `target`・`lower`/`upper` |
| 倍増タイム | `bonus`(`bonusStartsAt`・`bonusActive`) |
| ポイント | `points` |
| 実績・称号 | `stats`・`title` |
| 合図(押した合図。小人を跳ねさせる) | `pulse` |
| 演出(3・2・1、×3タイム、終了10秒前、終了) | `cue` |
| AI担当 | `aiHost` |
| 途中参加 | `joinedDuring: 'playing'` |

- **取り違えやすい組み合わせ**:
  - 「合図」(`pulse`。他の人が押したことを伝える信号)と「演出」(`cue`。段階が変わるときの画面の見せ方)は、別のもの
  - AIの性格「がめつい」は `AiPersonality` の `'greedy'`、称号「欲張り」は `TitleId` の `'hoarder'`。似た意味なので、名前を取り違えない
- 時刻は、すべて**サーバー時刻(ミリ秒)**で扱う。端末の時計(`Date.now()`)を、そのまま使わない。`ServerClock.now()` を使う

### コードフォーマット

既存の Prettier の設定(`.prettierrc`)に従う。手で整形しない。

- インデント: 2スペース
- 行の長さ: 80文字
- セミコロンあり、文字列はシングルクォート、末尾カンマは ES5 の範囲

### 関数設計

- 1つの関数は1つのことをする。目安は50行以内
- 引数が4つを超えたら、オブジェクトにまとめる
- ドメイン層の関数は、必要な情報をすべて引数で受け取る(グローバルな状態を読まない)
- 時刻は `nowMs`(または `RoundClock`)、乱数は `Random` で受け取る

```typescript
// ✅ 良い例: 時刻と乱数を引数で受け取るので、テストで結果を固定できる
function decide(
  personality: AiPersonality,
  view: AiView,
  dtMs: number,
  random: Random,
  params: AiParams
): '+1' | '-1' | null { /* ... */ }

// ❌ 悪い例: 結果がテストのたびに変わる
function decide(personality: AiPersonality, view: AiView): '+1' | '-1' | null {
  return Math.random() < 0.5 ? '+1' : null;
}
```

### 数値と時間

- 共有の数字・ポイント・目標・人数は整数だけを扱う。範囲の下端と上端は、`ceil`・`floor` で整数にする(`lower = ceil(target × 0.9)`、`upper = floor(target × 1.1)`)。浮動小数点で、範囲の端を比べない
- 時間はミリ秒の整数で扱う。秒を使う画面の表示は、表示の直前に変換する
- 調整する値は、`domain/config/defaultConfig.ts` の `DEFAULT_CONFIG`(型は、機能設計書の `GameConfig`)に1か所にまとめる。PRD・設計書で決めた値には、コメントで出典を書く。値を変えるときは、**先にドキュメントを直す**
- 関数には、設定を1つのオブジェクト(`config: GameConfig`)として渡す。テストで値を変えるときは、`{ ...DEFAULT_CONFIG, playMs: 180_000 }` のように、一部だけを差し替える
- **データベースのセキュリティルール(`database.rules.json`)にも、同じ値が書いてある**(1周の長さ、ゲームの開始と終了、ポイントの猶予の3秒、20人、±50など。対応は `architecture.md` の「データベースの配置とセキュリティルール」)。設定の値を変えたら、ルールの値も同じ値に直し、`npm run test:rules` を通す

```typescript
// ✅ 良い例
export const DEFAULT_CONFIG: GameConfig = {
  perPlayerTarget: 200, // 1人あたりの目標(PRD「準備」。仮置き)
  batchMs: 200,         // 連打をまとめて送る間隔(PRD機能1)
  bonusMultiplier: 3,   // 倍増タイムの倍率(PRD「個人ポイント」。仮置き)
  // ...(GameConfig のすべての項目)
};

// ❌ 悪い例
if (now > endsAt - 60000) { /* 60000 が何か分からない */ }
setTimeout(flush, 200);
```

### コメント規約

- コメントは日本語で書く
- 公開する関数と型には、TSDoc で「何をするか」と、引数・戻り値の意味を書く
- ルールにもとづく処理には、根拠(PRD・機能設計書の該当箇所)を書く
- インラインコメントは「なぜそうするか」を書く。コードを読めば分かる「何をしているか」は書かない

```typescript
/**
 * +1を押した瞬間のポイントを返す。
 *
 * @param input - 押した種類、押した瞬間の数字、目標、時刻、回の時計
 * @param config - 設定値
 * @returns 倍増タイム中で、範囲の中なら 3、それ以外の +1 は 1、−1 は 0
 */
export function pointsForPress(input: PressInput, config: GameConfig): number {
  // −1 はポイントに影響させない。−1 でポイントが減る仕組みにすると、
  // 誰も −1 を押さなくなるため(PRD「このゲームで決めたこと」)
  if (input.kind === '-1') return 0;
  // ...
}
```

### エラーハンドリング

**原則**:
- 予期しないエラーは握りつぶさず、上位(アプリケーション層)に伝える
- ドメイン層の関数は、無効な入力に対して、例外か、結果を表す値(`{ ok: false, reason }`)を返す。状態は変えない
- Firebase のエラーは、**インフラ層の中で捕まえて**、アプリケーション層が扱える形(結果を表す値、または、決めた種類の例外)に変える。`firebase/*` の例外を、そのまま上に流さない
- アプリケーション層は、機能設計書の「エラーハンドリング」の表に従って、利用者に表示する

```typescript
// infra/firebase/FirebaseGameStore.ts
async addToNumber(roomId: number, roundId: string, delta: number): Promise<void> {
  try {
    await update(ref(this.db), { [paths.number(roomId, roundId)]: increment(delta) });
  } catch (error) {
    if (isPermissionDenied(error)) {
      // 終了後の加算など、ルールに拒否された。画面は、データベースの値に合わせるので、無視してよい
      console.debug('書き込みが拒否されました:', error);
      return;
    }
    throw new StoreError('数字の加算に失敗しました', { cause: error });
  }
}

// ❌ 悪い例: エラーを無視する
try {
  await update(...);
} catch {
  // 何もしない
}
```

### 非同期処理

- 待ち時間(接続、送信、アニメーションの待ち)は `async`/`await` で書き、アプリケーション層とインフラ層にまとめる。ドメイン層は同期的な関数だけにする
- 待っている間に、回が変わる・部屋を出る・接続が切れることがある。待ち終わった後に、**同じ回が続いているか**を確認してから、次の処理に進む

```typescript
// ✅ 良い例: 待った後に、同じ回が続いているかを確かめる
const roundId = this.roundId;
const players = await this.store.readPlayers(roomId, roundId);
if (roundId !== this.roundId) return; // 待っている間に、次の回に変わった
```

- データベースの購読(`onNumber`・`onPlayers`・`onPulses` など)は、**解除する関数を必ず保持し**、回が終わったとき、部屋を出たときに解除する(解除し忘れると、古い回のデータが届き続け、通信量も増える)
- タイマー(`setTimeout`・`setInterval`)も、回の終わりに、まとめて止める。`PressBatcher` は、`stop()` を呼んで止める

### Firebase の扱い方

- Firebase に触れるのは `src/infra/firebase/` だけ。データベースのパスは `paths.ts` で作り、パスの文字列を、ほかの場所に書かない
- **共有の数字は、`increment` で加算する**(書き込み前の値を読んで、足して書き戻さない。同時に押したときに、取りこぼすため)
- 数字・合図・ポイントの送信は、複数の場所を一度に書き換える命令(`update`)にまとめる(通信量のため)
- 部屋への入室など、「条件を満たすときだけ」書くものは、条件付きの書き込み(トランザクション)で行う
- 切断時に自動で消したい印(`presence`)は、`onDisconnect` で登録する
- 時刻は、`ServerClock.now()` を使う。ゲームの進行や、判定に、端末の時計を使わない
- 他のプレイヤーのデータ(名前、キャラクター、実績)は、**信用せずに検証してから**使う。形が想定と違う値は、無視するか、既定の値にする(壊れたデータで、画面が止まらないようにする)
- 他の人が付けた名前は、HTMLとして解釈しない(下の「UIの実装」)
- 本番のデータベースに、テストのデータを書かない。開発とテストは、Emulator Suite を使う(`VITE_USE_EMULATOR=true`)

### UIの実装

- 画面に出す文言は、すべて `app/i18n/messages.ja.ts` と `messages.en.ts` に置き、`t()` で取り出す。コードの中に、文言を直接書かない。日本語と英語の**両方に、同じキーを足す**(足りないと、ビルドで失敗する)
- 英語の文言は、日本語をもとに、短く、やさしい言葉で書く。英語は長くなるので、札・ボタン・吹き出し・カードが、文字の長さに合わせて広がるか、折り返すように作る
- 他の人が付けた名前は、翻訳せず、文字として表示する。`textContent` で設定し、`innerHTML` に、ユーザー由来の文字列を渡さない(`innerHTML` を使うのは、固定のテンプレートだけ)
- 色は `ui/styles/theme.css` のCSS変数だけを使う。TypeScript や個別のCSSに、色の値を直接書かない
- 状態は、色だけで区別せず、文字や形も使う(例: 「範囲内!」の札は、色とチェックマークの両方)
- ボタンなど、タップする部品は、一辺44px以上にする。+1と−1のボタンは、同じ大きさで、左右対称に並べる
- ボタンやアイコンには、`aria-label` を付ける(例: 「+1」「−1」「言語を切り替える」)。言語を切り替えたら、`aria-label` も、その言語にする
- 動き(跳ねる・降りてくる・点滅する・浮かぶ・弾む)は、`architecture.md` の「動き(アニメーション)の実装方針」に従う(CSSのアニメーションで作り、JavaScriptで毎フレームの更新をしない)
- 「動きを減らす」設定(`prefers-reduced-motion`)が有効なときは、動きをやめる。`ui/styles/motion.css` に、まとめて書く
- 自分が押したときは、通信を待たずに、すぐ画面に反映する(数字・ポイント・小人・「+1」の吹き出し)

## テスト

### テストの種類と目標

| 種類 | 対象 | 目標 | コマンド |
|------|------|------|----------|
| ユニットテスト | ドメイン層、アプリケーション層(`InMemoryGameStore` を使う) | ドメイン層は、行・分岐・関数それぞれ80%以上 | `npm test` |
| ルールのテスト | `database.rules.json` | 機能設計書・技術仕様書の項目がすべて合格 | `npm run test:rules` |
| 結合テスト | Firebase Emulator Suite を使った、複数クライアントの動き | 機能設計書のシナリオがすべて合格 | `npm run test:int` |
| シミュレーション | AIだけの回 | 下の「シミュレーションの合格の条件」を満たす | `npm run test:sim` |
| E2Eテスト | 画面の一連の流れ | 機能設計書のシナリオがすべて合格(Chromium・Firefox・WebKit) | `npm run test:e2e` |

- UI層は、E2Eテストで確かめる。ユニットテストのカバレッジ目標は課さない

### シミュレーションの合格の条件

シミュレーションは、調整のための数字を出すことが主な目的だが、次の場合は、失敗にする(壊れた変更に気づくため)。

- どの回も、最後(結果発表)まで進む
- 最終の数字とポイントが、整数で、ポイントは0以上
- 人数と性格の組み合わせごとに、成功率が0%または100%に張り付いていない(ルールやAIが壊れていると、こうなりやすい)

毎回、組み合わせごとの成功率・ぴったり率・ポイントの分布を、表にしてログに出す。成功率は、PRDのKPI「手応え」の目安(30〜70%。仮)と見比べて、調整に使う(目安を外れても、失敗にはしない。AIだけの回は、人間の回と、成功率が違うため)。

### E2Eテストが不安定なとき

- 失敗したら、まず手元で、同じテストを何回か動かし、再現するかを確かめる。再現したら、不具合として直す
- 再現しない(タイミングによる)失敗は、待ち方(時刻を進める補助、画面の要素が出るまで待つ)を直す。固定の時間を待つ(`waitForTimeout`)ことで、ごまかさない
- CI では、Playwright の `retries` を1にする。手元では0にする。再実行で通ったテストは、レポートに「不安定」と出るので、放っておかずに直す

### テストの書き方

- Given-When-Then の順に書き、コメントで区切る
- テスト名は日本語で、「どういう条件で、どうなるか」を書く

```typescript
describe('pointsForPress', () => {
  it('倍増タイム中で、範囲の中の+1は、3ポイントになる', () => {
    // Given: 倍増タイム中で、数字が範囲の中にある
    const clock = clockAt({ remainingMs: 30_000 });
    const input = { kind: '+1', numberAtPress: 1000, target: 1000, nowMs: clock.playEndsAt - 30_000, clock } as const;

    // When
    const points = pointsForPress(input, DEFAULT_CONFIG);

    // Then
    expect(points).toBe(3);
  });

  it('倍増タイム中でも、範囲の外の+1は、1ポイントになる', () => {
    // ...
  });

  it('−1は、ポイントに影響しない', () => {
    // ...
  });
});
```

### テストの材料

- 設定・プレイヤー・回の状態を作る補助関数は `tests/unit/fixtures/` に置き、使い回す
- アプリケーション層のテストは、`InMemoryGameStore` と `FakeClock`(時刻を進められる時計)を使う。本物の `setTimeout` を待たない
- 乱数を使うテスト(AIの手など)は、種を固定した疑似乱数(`domain/ai/random.ts`)を使い、結果を再現できるようにする
- ドメイン層はモックを使わない(純粋な関数なので、本物をそのまま使う)
- Firebase に関わるテストは、本番ではなく、**Emulator Suite だけ**を使う

### 境界の値を必ずテストする

次の境界は、ルールの食い違いが起きやすいので、1つずつテストを書く。

- 範囲の端ちょうど(`lower`・`upper`)と、1つ外
- 目標とぴったり同じ
- 倍増タイムの開始のちょうど前後、ゲーム終了のちょうど前後
- 途中参加の締め切り(終了の1分前)のちょうど前後と、結果発表中
- 1回の送信の変化が、±50ちょうどと、±51
- 部屋の人数が19人・20人・21人のとき
- 名前の長さ(全角6文字、半角12文字、混ざったとき、13)
- 人が抜けても、目標が下がらないこと

### 不具合を直すとき

- まず不具合を再現するテストを書き、失敗することを確かめてから直す
- シミュレーションや結合テストで見つかった不具合は、そのときの乱数の種と状態を、ユニットテストに写す

## Git運用ルール

### ブランチ戦略

少人数の開発で、本番環境は itch.io だけなので、Git Flow ではなく、`main` と作業ブランチだけの運用にする。

```
main(いつでもビルド・公開できる状態)
 ├── feature/round-schedule
 ├── feature/ai-personalities
 └── fix/target-after-leave
```

| ブランチ | 用途 | 分岐元 | マージ先 |
|----------|------|--------|----------|
| `main` | 公開できる状態を保つ | — | — |
| `feature/[内容]` | 機能の追加 | `main` | `main` |
| `fix/[内容]` | 不具合の修正 | `main` | `main` |
| `docs/[内容]` | ドキュメントだけの変更 | `main` | `main` |
| `chore/[内容]` | 設定・依存の更新 | `main` | `main` |

- ブランチ名は英語の kebab-case
- 1つのステアリング(`.steering/[日付]-[作業名]/`)に、1つの作業ブランチを対応させる
- 少人数の開発のため、プルリクエスト(PR)は使わない。作業が終わったら、下の「main へのマージ前のチェック」を通し、手元で作業ブランチを `main` にマージ(fast-forward)して push する
- fast-forward できない(作業中に `main` が進んだ)場合は、作業ブランチを `main` に rebase してから、チェックをやり直してマージする
- `main` で直接作業しない(初回セットアップのコミットを除く)。マージした作業ブランチは削除する

### コミットメッセージ

Conventional Commits の形式で、要約は日本語で書く。

```
<type>(<scope>): <要約>

<本文: なぜ変更したか、何を変更したか>
```

**type**:

| type | 用途 |
|------|------|
| `feat` | 機能の追加 |
| `fix` | 不具合の修正 |
| `docs` | ドキュメント |
| `test` | テストの追加・修正 |
| `refactor` | 動作を変えないコードの整理 |
| `perf` | 性能(通信量を含む)の改善 |
| `style` | 整形だけの変更 |
| `build` | ビルド・依存の変更 |
| `ci` | CIの設定 |
| `chore` | その他 |

**scope**: 変更した場所。決まった一覧ではなく、次の名前から、いちばん近いものを選ぶ

- ドメイン層の分野: `config`・`schedule`・`targets`・`judge`・`points`・`pulses`・`ranking`・`titles`・`names`・`rooms`・`ai`・`layout`(複数の分野にまたがるときは `domain`)
- そのほか: `infra`・`app`・`ui`・`i18n`・`rules`(データベースのルール)・`unit`・`int`・`sim`・`e2e`・`scripts`・`docs`

**例**:
```
feat(points): 倍増タイム中の+1を3倍にする

PRDの「個人ポイント」に合わせて、最後の1分は、範囲の中で押した+1を
3倍にする。倍率と長さは、設定ファイルで変えられる。
- pointsForPress.ts に倍増タイムの判定を追加
- 境界(開始の前後、範囲の端)のテストを追加
```

### main へのマージ前のチェック

- [ ] `npm run lint` が通る
- [ ] `npm run typecheck` が通る
- [ ] `npm test` が通る
- [ ] データベースのルールを変えた場合、`database.rules.json` と設定の値が一致し、`npm run test:rules` が通る
- [ ] `GameStore` や、Firebase に関わる部分を変えた場合、`npm run test:int` が通る
- [ ] ルール(進行・目標・判定・ポイント)・AIを変えた場合、`npm run test:sim` が通る
- [ ] 画面を変えた場合、`npm run test:e2e` が通り、スマホ幅(幅390px・360px)で、日本語と英語の両方の見た目を確認した
- [ ] 文言を足した場合、日本語と英語の両方に、キーがある
- [ ] `tasklist.md` の全タスクが完了し、振り返りを書いた
- [ ] 下の「コードレビュー」の観点で、差分を見直した(Claude Code の `/code-review` を使ってもよい)

## コードレビュー

### レビューの観点

**ルールの正しさ**(最優先):
- [ ] PRDの「ゲームのルール」と一致しているか(特に、範囲の端、ぴったり、倍増タイムの条件、途中参加で目標が増えること、人が抜けても目標が下がらないこと、AIの数が開始時点で決まること(ゲーム開始の時刻に人間がいなかった回は、最初の人間が来た時点)、結果が終了の3秒後に出ること)
- [ ] 判定をドメイン層以外で書き直していないか
- [ ] 境界の値のテストがあるか(上の「境界の値を必ずテストする」)

**設計**:
- [ ] 層の依存ルールを守っているか(ESLint が通れば守られている。入れるのは実装の最初の作業で、それまではレビューで確かめる)
- [ ] ドメイン層の分野の間の依存が、`repository-structure.md` の「モジュール間の依存」の向きになっているか(ESLint で強制する。表を変えたときは、図と表が一致しているか)
- [ ] 状態を書き換えていないか
- [ ] 乱数・時刻を、ドメイン層で直接使っていないか(`ServerClock.now()` と `Random` を使う)
- [ ] `firebase/*` を、`infra/firebase/` の外で import していないか

**Firebase・通信**:
- [ ] 共有の数字を、`increment` で加算しているか(読んで、足して、書き戻していないか)
- [ ] 連打をまとめて送り、合図を間引いているか。1回の送信の変化を、±50(`maxDeltaPerWrite`)までにしているか
- [ ] 購読の解除と、タイマーの停止を、回の終わりに行っているか
- [ ] データベースから読んだ値を、検証してから使っているか
- [ ] セキュリティルールと設定の値が、一致しているか。ルールのテストを足したか

**型**:
- [ ] `any` を使っていないか(ESLint でエラーになる)
- [ ] ドメインの型のプロパティと配列に `readonly` が付いているか
- [ ] `enum` ではなく文字列リテラルの合併型を使っているか(ESLint でエラーになる)

**読みやすさ**:
- [ ] 名前が用語集と一致しているか
- [ ] 数値の決めごとに名前が付き、設定ファイルにまとまっているか
- [ ] コメントが「なぜ」を説明しているか

**画面**:
- [ ] 文言を `i18n` にまとめ、日本語と英語の両方があるか
- [ ] 他の人の名前を、文字として表示しているか(`innerHTML` を使っていないか)
- [ ] 色をCSS変数で指定しているか。色と、文字・形の両方で区別しているか
- [ ] タップする部品が44px以上か
- [ ] 動きをCSSで作り、「動きを減らす」設定でやむか
- [ ] 英語にしても、文字が枠からはみ出さないか

### コメントの書き方

優先度を付けて、理由と代案を書く。

- `[必須]`: 直さないとマージできない
- `[推奨]`: 直すことを勧める
- `[提案]`: 検討してほしい
- `[質問]`: 理解のための質問

```markdown
✅ [必須] 範囲の上端が `target * 1.1` のままです。小数になる目標があると、
整数の数字との比較で、境界がずれます。PRDの「範囲は目標の±10%」を、
整数で扱えるように、`floor` で切り下げてください。

❌ ここ間違ってます。
```

## 品質の自動化

### コミット前(husky + lint-staged)

既存の設定のとおり、コミット前に次が自動で走る。

- 変更した `.ts` ファイルへの `eslint --fix` と `prettier --write`
- `npm run typecheck`

### CI(GitHub Actions)

リポジトリ(GitHub)への push で、次を実行する(PR を作った場合は PR でも実行する)。設定(`.github/workflows/ci.yml`)は実装の最初の作業で、`eslint.config.js` の層のルールと一緒に追加する。Emulator Suite を使うジョブは、Java 11以上のセットアップ(`actions/setup-java`)が必要。

| ジョブ | 内容 | タイミング | `paths` の指定(変更したファイルで絞るとき) |
|--------|------|-----------|------|
| check | `npm run lint`・`npm run typecheck`・`npm test` | すべての push | なし |
| build | `npm run build` と `npm run check:size`(配信サイズが `architecture.md` の上限を超えたら失敗) | すべての push | なし |
| rules | `npm run test:rules` | `database.rules.json`・`src/domain/config/` を変えた push、`main` への push | `['database.rules.json', 'src/domain/config/**', 'tests/rules/**']` |
| int | `npm run test:int` | `src/infra/`・`src/app/` を変えた push、`main` への push | `['src/infra/**', 'src/app/**', 'tests/int/**']` |
| e2e | `npm run test:e2e` | `main` への push | なし(`main` だけで動かす) |
| sim | `npm run test:sim` | `src/domain/` を変えた `main` への push | `['src/domain/**', 'tests/sim/**']`(`main` だけ) |

- 「`main` への push では、変更に関わらず動かす」ジョブ(rules・int)は、`paths` で絞ったワークフローと、`main` 用のワークフローの2つの起動条件を書くか、ジョブの中で、変更したファイルを調べて判断する

## リリース(itch.io への公開)

1. `main` で、`npm run lint`・`npm run typecheck`・`npm test`・`npm run test:rules`・`npm run test:int`・`npm run test:sim`・`npm run test:e2e` がすべて通ることを確かめる
2. **データベースのセキュリティルール(`database.rules.json`)を、本番に反映する**(`firebase deploy --only database`)。ユーザー(開発者)が、自分で行う。反映するルールが、設定の値と一致していることを、確かめる
3. `npm run build` で `dist/` を作り、`npm run preview` で PC とスマホ幅の表示を、日本語と英語の両方で確かめる。環境変数(`VITE_FIREBASE_*`)は、本番の値にする
4. **本番のデータベースにつないで**、`VITE_TRAFFIC_METER=1` を付けたビルドで、複数の端末で遊び、通信量を測る(PRDの機能9。測り方は `architecture.md` の「通信量の計測」)。公開用のビルドは、`VITE_TRAFFIC_METER` を付けずに作り直す
5. 実機で、Safari(iPhone)と Chrome(Android)で、itch.io の埋め込みの中で、IDが保存できるか(開き直したときに、同じ実績が出るか)を確かめる(保存できない場合の表示も確かめる)
6. `npm run package:itch` で `release/number-together-v[バージョン].zip` を作り、itch.io の管理画面(Edit game > Uploads)から手動でアップロードする(itch.io の設定は `docs/architecture.md` の「デプロイ(itch.io)」)
7. `main` にバージョンのタグを付ける(例: `v0.1.0`)。最初の版(P0)を `v0.1.0` とし、P1の機能を足すたびにマイナーバージョンを上げる

## 開発環境

### 必要なツール

| ツール | バージョン | 入れ方 |
|--------|-----------|--------|
| Docker と VS Code(Dev Containers 拡張) | 最新 | 各公式サイト |
| Node.js | v24 LTS | devcontainer に含まれる |
| Java(JDK) | 11以上 | devcontainer に含まれる(Emulator Suite のデータベースに必要) |
| Firebase CLI | `firebase-tools`(開発時の依存として入る) | `npm install` で入る。エミュレータだけを使うなら、ログインは不要 |
| Playwright のブラウザ | @playwright/test に対応するもの | `npx playwright install --with-deps chromium firefox webkit` |

### セットアップ手順

```bash
# 1. リポジトリを取得して、VS Code の「Reopen in Container」で開く
git clone [リポジトリのURL]
cd number-together

# 2. 依存を入れる(devcontainer の作成時に自動で実行される)
npm install

# 3. E2Eテスト用のブラウザを入れる(初回だけ)
npx playwright install --with-deps chromium firefox webkit

# 4. 環境変数のひな形をコピーする(エミュレータだけで開発するなら、値は仮でよい)
cp .env.example .env.local

# 5. 1つ目の端末で、Emulator Suite を起動する
npm run emulators

# 6. 2つ目の端末で、開発サーバーを起動する(.env.local の設定で、エミュレータにつなぐ)
npm run dev
```

- `.env.local` がない(`VITE_FIREBASE_DATABASE_URL` がない)とき、または `VITE_STORE=memory` のときは、**ローカルモード**(メモリ上のサーバー。Firebase もエミュレータも要らない。1人でAIと遊べる。ページを閉じるとデータは消える)で動く
- `VITE_QUICK_CYCLE=1` を付けると、短い周期(1周10秒。`src/domain/config/quickConfig.ts`)で動く。エミュレータにつなぐときは、ルールの時刻の数値も、同じ値に置き換えて読み込ませる(`tests/support/testCycle.ts` の `scaledRules`)

### 同じ Wi-Fi の実機で試す

開発用の PC の Emulator Suite に、同じ Wi-Fi の iPhone・Android・PC を何台もつなぎ、複数人のプレイを試す。本番の Firebase プロジェクトがなくても試せる。

```bash
npm run dev:lan          # 本物の周期(1周6分)
npm run dev:lan:quick    # 短い周期(1周10秒)。ルールも短い周期に置き換えて読み込ませる
VITE_TRAFFIC_METER=1 npm run dev:lan   # 通信量も見る(画面の右下)
```

- エミュレータ(`firebase.lan.json`。認証9099・データベース9000)と開発サーバー(5173)を、すべての接続口(`0.0.0.0`)で起動する。Ctrl+C で、両方とも止まる
- アプリは `.env.lan` の `VITE_EMULATOR_HOST=page` で、エミュレータのつなぎ先を、開いたページのホスト(PC のアドレス)にする
- いつもの `npm run emulators` とテストは、これまでどおり 127.0.0.1 だけで受け付ける(LAN の端末から、テストのデータを書き換えられないように)

**最初に1回だけ、ユーザー(開発者)が行う設定**

1. VS Code の設定(ユーザー設定)で、`remote.localPortHost` を `allInterfaces` にする。devcontainer が転送するポート(`.devcontainer/devcontainer.json` の `forwardPorts`: 5173・9000・9099)が、PC の LAN 側でも開く。設定を変えたら、「ポート」タブで転送をやり直すか、ウィンドウを再読み込みする
2. PC のファイアウォールで、5173・9000・9099 の受信を、同じ Wi-Fi(プライベートネットワーク)から許可する
3. PC の LAN 側のアドレス(例: `192.168.1.23`)を調べる。コンテナの中で表示される `Network: http://172.17.x.x:5173` は、コンテナのアドレスなので、スマホからは使えない

**試し方**

- 各端末で `http://<PC のアドレス>:5173` を開く。同じブラウザの別タブは、同じ利用者になるので、人数を増やすときは、別の端末か、別のブラウザ(シークレットウィンドウ)を使う
- エミュレータのデータは、止めると消える。Emulator Suite の画面(PC で `http://localhost:4000`)で、データベースの中身を見られる
- ゲーム中に来て、部屋が1つもないときは、ルールどおり「満員」の待機になり、次の回の集合から入る。本物の周期で試すときは、集合中(回の最初の30秒)に入るか、`dev:lan:quick` を使う

**エミュレータでは確かめられないこと**(本番の Firebase プロジェクトで、公開前に確かめる)

- 通信の遅れ(本番のデータベースはシンガポール。エミュレータは同じ PC なので、遅れがほとんどない)
- 混雑中の画面(エミュレータには、同時接続の上限がない)
- itch.io の iframe の中での、記録の保存

- 本番の Firebase プロジェクトを作る手順(プロジェクトの作成、データベースの場所の選択、匿名認証、ルールの反映、環境変数)は、`docs/firebase-setup.md` に書く。**これは、ユーザー(開発者)が自分で行う作業**
- Firebase の接続の設定(`VITE_FIREBASE_*`)は、公開される前提で、秘密ではない。ただし、環境ごとに切り替えるため、`.env.local`(Git 管理外)に置く。サービスアカウントの鍵など、本当の秘密情報は、リポジトリにも、コンテナにも、置かない

## 作業の進め方

`CLAUDE.md` の「スペック駆動開発」に従う。

1. 作業ごとに `.steering/[YYYYMMDD]-[作業名]/` を作り、`requirements.md`・`design.md`・`tasklist.md` を書く
2. 作業ブランチを切り、`tasklist.md` に沿って実装する。進んだら `tasklist.md` を更新する
3. テストを書き、上の「main へのマージ前のチェック」を通す
4. ルールや設計が変わった場合は、`docs/` の該当ドキュメントも同じ作業ブランチで更新する
5. `main` にマージして push し、GitHub Actions の CI が通ることを確かめる

**ユーザー(開発者)にしかできない作業**(Firebase のプロジェクトの作成、データベースの場所の選択、匿名認証をオンにすること、セキュリティルールの本番への反映と確認、itch.io のアップロード)は、`tasklist.md` に、チェックボックスとして入れない(全タスクが完了するまで止まらない決まりなので、終わらなくなるため)。手順は `docs/firebase-setup.md` に書き、その作業が終わっていなくても進められるよう、Emulator Suite で開発とテストを行う。

**未決事項**(PRDの「未決定事項」)にかかわる部分は、アイデアメモの仮の値で実装して、設定ファイルの値にする。決め直す必要がありそうなことは、`tasklist.md` の「実装後の振り返り」の、次回への改善提案に書く。

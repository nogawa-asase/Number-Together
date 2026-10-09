# リポジトリ構造定義書 (Repository Structure Document)

このドキュメントは、`docs/architecture.md` で決めた層(UI・アプリケーション・ドメイン・インフラ)と技術構成(Vite・Vitest・Playwright・Firebase)を、具体的なディレクトリとファイルの配置に落とし込む。

## プロジェクト構造

```
number-together/
├── index.html                 # Vite の入口となるHTML(アプリの土台)
├── src/                       # ソースコード
│   ├── main.ts                # 起動処理: 各層を組み立ててアプリを開始する
│   ├── domain/                # ドメイン層: ルール・目標・判定・ポイント・AIの手(画面にもFirebaseにも依存しない)
│   │   ├── config/            #   設定値(仮の値をまとめたもの)
│   │   ├── schedule/          #   時計から、回と段階を計算する
│   │   ├── targets/           #   目標と範囲
│   │   ├── judge/             #   結果の判定(ぴったり・成功・失敗)
│   │   ├── points/            #   ポイントの計算と、報酬・実績の変化
│   │   ├── pulses/            #   合図の強さ(power)の計算
│   │   ├── ranking/           #   結果発表の一覧
│   │   ├── titles/            #   称号
│   │   ├── names/             #   名前の長さ・使える文字
│   │   ├── rooms/             #   部屋の割り振りの判断
│   │   ├── ai/                #   AIの手の選択(性格ごと)と乱数
│   │   └── layout/            #   小人の並べ方・グラフの座標など、画面に出す形の計算(純粋な関数)
│   ├── infra/                 # インフラ層: Firebase・時計の同期・ブラウザに覚える設定
│   │   ├── store/             #   GameStore のインターフェース
│   │   ├── firebase/          #   Firebase を使った実装(ここだけが firebase を import する)
│   │   └── memory/            #   メモリ上の実装(テスト・シミュレーション用)
│   ├── app/                   # アプリケーション層: 参加・進行・連打のまとめ送り・AI担当・文言
│   │   └── i18n/              #   言語の状態と、言語ごとの文言の一覧
│   └── ui/                    # UI層: 画面・小人・グラフ・演出・入力
│       ├── stage/             #   小人の舞台(キャラクター・ロボット)
│       ├── graph/             #   グラフ
│       ├── overlays/          #   演出(合図・召喚・吹き出し)
│       ├── screens/           #   各画面
│       └── styles/            #   CSS
├── scripts/                   # 開発用スクリプト
│   ├── check-dist-size.ts     # ビルド結果の配信サイズを確認する
│   └── package-itch.ts        # dist/ をitch.io用のzipにまとめる
├── public/                    # そのまま配信するファイル(必要になったときだけ使う)
├── tests/                     # テストコード
│   ├── unit/                  # ユニットテスト(src と同じ構造)
│   ├── rules/                 # データベースのセキュリティルールのテスト
│   ├── int/                   # Firebase Emulator Suite を使った結合テスト
│   ├── sim/                   # AIだけの回のシミュレーション
│   ├── e2e/                   # E2Eテスト(Playwright)
│   └── helpers/               # エミュレータへの接続など、複数のテストで使う補助
├── docs/                      # 永続ドキュメント
│   ├── ideas/                 #   壁打ち・アイデアメモ
│   └── design/                #   画面の資料(見本)
├── .steering/                 # 作業単位のドキュメント
├── .claude/                   # Claude Code の設定
├── .devcontainer/             # 開発コンテナの設定
├── .husky/                    # コミット前チェック
├── .github/                   # GitHub Actions(CI)
├── firebase.json              # Firebase の設定(エミュレータのポートなど)
├── .firebaserc                # Firebase のプロジェクトの指定
├── database.rules.json        # Realtime Database のセキュリティルール
├── .env.example               # 環境変数のひな形(本物の .env.local は Git 管理外)
├── vite.config.ts             # Vite の設定
├── vitest.config.ts           # Vitest の設定(ユニットテスト)
├── vitest.sim.config.ts       # Vitest の設定(シミュレーション)
├── vitest.int.config.ts       # Vitest の設定(結合テスト)
├── vitest.rules.config.ts     # Vitest の設定(ルールのテスト)
├── playwright.config.ts       # Playwright の設定
├── eslint.config.js           # ESLint の設定(層の依存ルールを含む)
├── .prettierrc                # Prettier の設定
├── tsconfig.json              # TypeScript の設定
├── package.json
├── README.md
└── LICENSE
```

ビルドの出力 `dist/` と、itch.io用のzip `release/` は、Git で管理しない。`dist/` の中身を zip にして itch.io にアップロードする(`architecture.md` のデプロイ)。

## ディレクトリ詳細

### src/ (ソースコードディレクトリ)

#### main.ts

**役割**: アプリの起動。`FirebaseGameStore` と `ServerClock` を作り、アプリケーション層の `SessionController`・`RoundController` と、UI層の `DomGameView` を結びつけて、起動する。

- 各層を組み立てるのはこのファイルだけ。ここ以外で、層をまたいだ組み立てをしない
- Firebase の設定は、環境変数(`VITE_FIREBASE_*`)から読む。`VITE_USE_EMULATOR=true` のときは、エミュレータにつなぐ
- `VITE_TRAFFIC_METER=1` のときは、通信量の計測(`TrafficMeter`)を有効にする。テストプレイ用のビルドのときだけ、コマンドの前に付けて渡す(例: `VITE_TRAFFIC_METER=1 npm run build`)。`.env.local` には書かない(公開用のビルドに混ざらないようにするため)

#### domain/

**役割**: ドメイン層。ルール、目標、判定、ポイント、結果の一覧、称号、名前の検証、部屋の割り振りの判断、AIの手の選択、画面に出す形の計算。画面にも、Firebaseにも、ブラウザにも依存しない純粋な計算で、ブラウザ・Node.js(テスト、シミュレーション)の両方で動く。

**配置ファイル**:
- `types.ts`: ドメイン全体で使う型(`Lang`・`Phase`・`Player`・`Profile`・`CharacterSpec`・`Stats`・`RoundView`・`Outcome` など。機能設計書のデータモデル)
- `errors.ts`: ドメインのエラー(`InvalidNameError` など)
- 各分野のディレクトリ(下)

**命名規則**:
- 関数を公開するファイルは camelCase(例: `roundClockAt.ts`、`pointsForPress.ts`)
- 型だけのファイルは `types.ts`
- 各分野のディレクトリに、まとめて公開するためのファイル(`index.ts`)は置かない。使う側は、ファイルを直接 import する(依存の向きを、import の行から読み取れるようにするため)

**依存関係**:
- 依存可能: `domain/` の中だけ
- 依存禁止: `app/`・`ui/`・`infra/`・`firebase/*`・DOM・`window`・`document`・タイマー・`Math.random`・`Date.now`(ESLint で強制する)。乱数と時刻は、引数で受け取る

**例**:
```
domain/
├── types.ts
├── errors.ts
├── config/
│   ├── types.ts                # GameConfig
│   └── defaultConfig.ts        # 仮の値の既定(進行の長さ、1人あたりの目標、倍率、人数の上限など)
├── schedule/
│   ├── types.ts                # RoundClock・JoinVerdict
│   ├── roundClockAt.ts         # サーバー時刻から、回・段階・開始と終了の時刻を計算する
│   └── canJoinNow.ts           # 途中参加できる時刻か(終了の1分前まで)
├── targets/
│   ├── targetFor.ts            # 人数 × 1人あたりの目標
│   ├── rangeFor.ts             # 目標の±10%(下端・上端)、範囲内の判定
│   └── displayPlayerCount.ts   # 集合中に出す人数 = max(人間, AIで補う人数)
├── judge/
│   └── judge.ts                # ぴったり・成功・失敗と、足りなかった量
├── points/
│   ├── pointsForPress.ts       # +1を押した瞬間のポイント(倍増タイムと範囲の判定)
│   └── settle.ts               # 結果から、報酬と実績の変化を求める
├── pulses/
│   └── pulsePowerFor.ts        # 直近1秒に押した回数から、合図の強さ(0〜3)を求める
├── ranking/
│   └── buildRanking.ts         # 上位7人と、自分の行(圏外のとき)
├── titles/
│   └── titleOf.ts              # 実績から称号を決める(条件は設定値)
├── names/
│   ├── nameUnits.ts            # 全角を2、半角を1と数える
│   └── validateName.ts         # 長さと使える文字の検証
├── rooms/
│   └── planRoom.ts             # 入る部屋・新しい部屋・待機の判断
├── ai/
│   ├── random.ts               # Random インターフェースと、種を固定できる疑似乱数
│   ├── aiParams.ts             # 性格ごとの、押す頻度・反応の遅れなどの初期値
│   ├── decide.ts               # 性格に応じて、手を選ぶ入口(機能設計書の AiBrain)
│   └── personalities/
│       ├── greedy.ts           # がめつい
│       ├── balancer.ts         # 調整役
│       ├── perfectionist.ts    # ぴったり主義
│       ├── moody.ts            # 気まぐれ
│       └── lastSpurt.ts        # ラストスパート
└── layout/
    ├── stageLayout.ts          # 人数から、小人の並べ方(間隔・重なり・奥と手前)を求める
    └── graphGeometry.ts        # 値と時刻を、グラフの縦横の位置(%)に変換する
```

#### infra/

**役割**: インフラ層。Firebase とのやりとり、サーバー時刻との差の補正、ブラウザに覚える設定を、ここに閉じ込める。

**配置ファイル**:
- `store/GameStore.ts`: `GameStore` のインターフェース(機能設計書の「GameStore」)。アプリケーション層が使う
- `store/ServerClock.ts`: `ServerClock` のインターフェース
- `firebase/`: Firebase を使った実装(下)
- `memory/`: メモリ上の実装(下)
- `prefs.ts`: 言語・「動きをへらす」を、ブラウザに覚える(`localStorage`。使えなければ、開いている間だけ保つ)

**命名規則**:
- クラスとインターフェースのファイルは PascalCase(例: `FirebaseGameStore.ts`、`GameStore.ts`)
- 関数だけのファイルは camelCase(例: `prefs.ts`)

**依存関係**:
- 依存可能: `domain/` の型
- 依存禁止: `app/`・`ui/`。ルールの判定(ドメイン層の仕事)を、ここで行うこと
- `firebase/*` を import してよいのは、`infra/firebase/` の中だけ(ESLint で強制する)

**例**:
```
infra/
├── store/
│   ├── GameStore.ts           # インターフェース
│   └── ServerClock.ts         # インターフェース
├── firebase/
│   ├── firebaseApp.ts         # 初期化(環境変数から設定を読む。エミュレータへの接続の切り替え)
│   ├── auth.ts                # 匿名認証と、IDの保持(保存できないときは、メモリ上に切り替える)
│   ├── connection.ts          # 接続の状態(オンライン・オフライン)の検知
│   ├── serverClock.ts         # .info/serverTimeOffset を使った ServerClock の実装
│   ├── paths.ts               # データベースのパスを作る関数(配置を、ここ1か所に集める)
│   ├── FirebaseGameStore.ts   # GameStore の実装(部屋・回・数字・合図・ポイント)
│   └── TrafficMeter.ts        # 通信量の計測(テスト用。VITE_TRAFFIC_METER=1 のときだけ有効)
└── memory/
    ├── InMemoryGameStore.ts   # GameStore のメモリ上の実装(テスト・シミュレーション用)
    └── FakeClock.ts           # 時刻を進められる ServerClock(テスト・シミュレーション用)
```

#### app/

**役割**: アプリケーション層。参加と部屋、回の進行と画面の切り替え、連打のまとめ送り、AI担当、文言。ドメイン層の純粋な計算と、インフラ層の `GameStore` を、結びつける。

**配置ファイル**:
- `SessionController.ts`: 機能設計書の `SessionController`(サインイン、プロフィール、部屋への入室と退出、接続の状態)
- `RoundController.ts`: 機能設計書の `RoundController`(時計を見た画面の切り替え、`RoundView` の組み立て、押された操作の処理、演出のきっかけ、結果の計算と実績の保存)
- `PressBatcher.ts`: 連打のまとめ送り(0.2秒ごと)と、合図の間引き
- `AiHost.ts`: AI担当の動き(AIの追加、AIの手の送信、担当の引き継ぎ、古い回のデータの削除)
- `GameView.ts`: UI層が実装する `GameView` インターフェース(アプリケーション層が必要とする画面の操作を、ここで定める)
- `i18n/`: 言語の状態と、言語ごとの文言の一覧

**命名規則**:
- クラスとインターフェースのファイルは PascalCase(例: `RoundController.ts`)
- 関数や定数のファイルは camelCase

**依存関係**:
- 依存可能: `domain/`・`infra/` の**インターフェース**(`GameStore`・`ServerClock`)
- 依存禁止: `ui/`(UI層は `GameView` インターフェースを通してだけ扱う)、`infra/firebase/` と `infra/memory/` の実装(どの実装を使うかは、`main.ts` が決めて渡す)、`firebase/*`

**例**:
```
app/
├── SessionController.ts
├── RoundController.ts
├── PressBatcher.ts
├── AiHost.ts
├── GameView.ts
└── i18n/
    ├── i18n.ts                # getLang・setLang・onLangChange・t(今の言語の文言を返す)
    ├── keys.ts                # 文言のキーの型(日本語と英語の両方にないと、ビルドで失敗させる)
    ├── messages.ja.ts         # 日本語の文言の一覧
    └── messages.en.ts         # 英語の文言の一覧(日本語をもとに作る)
```

#### ui/

**役割**: UI層。`GameView` の実装、18の画面と演出の描画、入力の受付。

**配置ファイル**:
- `DomGameView.ts`: `GameView` の実装。下の部品を組み合わせる
- `LanguageSwitch.ts`: 言語の切り替えボタン(どの画面でも、右上に置く)
- `stage/`: 小人の舞台
- `graph/`: グラフ
- `overlays/`: 演出
- `screens/`: 各画面
- `styles/`: CSS

**命名規則**:
- 画面の部品(クラス)のファイルは PascalCase(例: `StageView.ts`、`PlayScreen.ts`)
- 関数だけのファイルは camelCase(例: `characterSvg.ts`)
- CSS は kebab-case(例: `stage.css`、`theme.css`)

**依存関係**:
- 依存可能: `app/`(`GameView` インターフェース、`RoundController`・`SessionController` の公開メソッド、`i18n`)、`domain/` の型と純粋関数(例: `stageLayout`・`graphGeometry`)
- 依存禁止: ゲームの状態を直接書き換えること(状態の変更は `RoundController` を通す)、`infra/`、`firebase/*`

**例**:
```
ui/
├── DomGameView.ts
├── LanguageSwitch.ts
├── stage/
│   ├── StageView.ts            # 小人の舞台全体(並べ方・跳ねる動き・「あなた」の吹き出し・「+1」の吹き出し)
│   ├── characterSvg.ts         # 人間のキャラクター(髪型・服の色・小物)のSVGを作る
│   ├── robotSvg.ts             # AIのロボット(胸のランプの色で性格が分かる)のSVGを作る
│   └── nameBubble.ts           # 名前の吹き出し(タップしたとき・少人数のとき)
├── graph/
│   └── GraphView.ts            # 線・範囲の帯・目標の点線・「いま」・未来の斜線・終了の線・残り時間
├── overlays/
│   ├── cues.ts                 # 合図(3・2・1・スタート、×3タイム、終了10秒前、終了)
│   ├── summon.ts               # 途中参加の召喚(光の柱、降りてくる小人、「目標UP!」の吹き出し、称号の帯)
│   └── fadeIn.ts               # 集合中に入る人・AIの、フェードイン
├── screens/
│   ├── SetupScreen.ts          # 名前とキャラクター選び
│   ├── LobbyScreen.ts          # 集合中(AIが加わる場面を含む)
│   ├── PlayScreen.ts           # プレイ中
│   ├── ResultScreen.ts         # 結果発表(ぴったり・成功・失敗)
│   ├── AchievementCard.ts      # 実績カード
│   ├── WaitScreen.ts           # 待機(満員・終了間際・結果発表中)
│   ├── OfflineScreen.ts        # 通信が切れたとき
│   ├── BusyScreen.ts           # 混雑中
│   └── MyPageScreen.ts         # 自分の画面
└── styles/
    ├── theme.css               # 色のCSS変数、言語の切り替えボタン
    ├── layout.css              # 幅390pxの縦画面、PCでの中央寄せ
    ├── stage.css               # 小人の舞台と、跳ねる・弾むなどの動き
    ├── graph.css
    ├── overlays.css            # 合図・召喚・吹き出しの動き
    ├── screens.css             # 各画面
    └── motion.css              # 「動きを減らす」設定(prefers-reduced-motion)のときの上書き
```

### scripts/ (スクリプトディレクトリ)

**役割**: 開発時にだけ使うスクリプト。

**配置ファイル**:
- `check-dist-size.ts`: `dist/` の合計サイズを計算し、上限(`architecture.md` の「リソース使用量」)を超えたら失敗する。CIの build ジョブで実行する(`npm run check:size`)
- `package-itch.ts`: `npm run build` のあと、`dist/` の中身を(`dist/` フォルダ自体は含めずに)`release/number-together-v[バージョン].zip` にまとめる。itch.io は zip 直下の `index.html` をゲームの入り口として扱うため、`dist/` の中に cd してから zip 化する。`npm run package:itch` で、ビルドからまとめて実行できる。`release/` は Git 管理外(`.gitignore`)

**依存関係**:
- 依存可能: Node.js の標準のモジュールだけ(どちらのスクリプトも、ファイルを扱うだけで、ゲームのコードを使わない)
- 依存禁止: `src/` のすべて。配信サイズの上限は、`check-dist-size.ts` の中に定数で持つ(`architecture.md` の「リソース使用量」と同じ値)

### public/ (そのまま配信するファイル)

**役割**: Vite がビルド時に加工せず `dist/` にコピーするファイル。最初の版では、特に置くものがない(書体は、外部から読み込む)。ファビコンなどを置くときに使う。

### tests/ (テストディレクトリ)

テストは `src/` と分けて置く。実行するコマンドは次のとおり。

| コマンド | 実行するテスト |
|----------|----------------|
| `npm test` | `tests/unit/` |
| `npm run test:rules` | `tests/rules/`(Emulator Suite を起動して実行) |
| `npm run test:int` | `tests/int/`(Emulator Suite を起動して実行) |
| `npm run test:sim` | `tests/sim/`(時間がかかるため別コマンド) |
| `npm run test:e2e` | `tests/e2e/`(ビルドして、Emulator Suite を起動してから Playwright で実行) |

#### unit/

**役割**: ドメイン層を中心としたユニットテストと、アプリケーション層(`InMemoryGameStore` と `FakeClock` を使う)のテスト。

**構造**:
```
tests/unit/
├── fixtures/                  # 設定・プレイヤー・回の状態を作る補助関数
├── domain/                    # src/domain と同じ構造
│   ├── schedule/
│   │   └── roundClockAt.test.ts
│   ├── targets/
│   │   └── targetFor.test.ts
│   ├── judge/
│   │   └── judge.test.ts
│   ├── points/
│   │   ├── pointsForPress.test.ts
│   │   └── settle.test.ts
│   ├── pulses/
│   │   └── pulsePowerFor.test.ts
│   ├── ranking/
│   ├── titles/
│   ├── names/
│   │   └── validateName.test.ts
│   ├── rooms/
│   ├── ai/
│   │   └── personalities.test.ts
│   └── layout/
├── app/                       # src/app と同じ構造
│   ├── PressBatcher.test.ts
│   ├── AiHost.test.ts
│   └── i18n.test.ts           # 日本語と英語の両方に、すべてのキーがあること
└── infra/
    └── memory/
        └── InMemoryGameStore.test.ts
```

**命名規則**:
- パターン: `[テスト対象のファイル名].test.ts`
- 例: `pointsForPress.ts` → `pointsForPress.test.ts`
- 複数のテストで使う材料は `tests/unit/fixtures/` に置く

#### rules/

**役割**: データベースのセキュリティルール(`database.rules.json`)のテスト(`@firebase/rules-unit-testing`)。

**構造**:
```
tests/rules/
├── number.rules.test.ts       # ゲーム中だけ加算できる、±50、終了後は拒否
├── rounds.rules.test.ts       # いまの回でない roundId への書き込みの拒否、古い回の削除(AI担当だけ)
├── points.rules.test.ts       # 終了の3秒後まで本人しか読めない、減らない
├── players.rules.test.ts      # 追加だけ、AIはAI担当だけ
├── pulses.rules.test.ts       # 自分の分だけ(AIはAI担当)、power は 0〜3、いまの回だけ
└── users.rules.test.ts        # 自分のプロフィール・実績だけ書ける
```

**命名規則**: `[対象].rules.test.ts`

#### int/

**役割**: Firebase Emulator Suite を使った結合テスト(複数のクライアントを、同時に動かす)。

**構造**:
```
tests/int/
├── concurrentPress.int.test.ts   # 同時に押しても取りこぼさない
├── roomAssignment.int.test.ts    # 25人が同時に入る
├── aiHost.int.test.ts            # AI担当の決まり方と引き継ぎ
└── reconnect.int.test.ts         # 切断と、60秒以内の再接続
```

**命名規則**: `[シナリオ].int.test.ts`

#### sim/

**役割**: AIだけの回のシミュレーション(成功率・ぴったり率・ポイントの分布を調べる。目標・範囲・倍増タイム・倍率の調整に使う)。

**構造**:
```
tests/sim/
└── aiRounds.sim.test.ts
```

**命名規則**: `[シナリオ].sim.test.ts`。`npm test` では除外し、`npm run test:sim` でだけ実行する

#### e2e/

**役割**: ビルドした `dist/` を使ったE2Eテスト(Playwright)。複数のブラウザコンテキストで、複数人の参加を再現する。

**構造**:
```
tests/e2e/
├── full-round.spec.ts         # 初回の登録から、結果発表、次の集合中まで
├── late-join.spec.ts          # 途中参加(目標UPと召喚)
├── wait.spec.ts               # 満員・終了間際・結果発表中の待機
├── offline.spec.ts            # 通信が切れて戻る
├── mobile.spec.ts             # スマホ幅360pxの表示とタッチ操作
├── language.spec.ts           # 日本語と英語の切り替え。文字がはみ出さない
└── reduced-motion.spec.ts     # 「動きを減らす」設定で、動きがやむ
```

**命名規則**: `[シナリオ].spec.ts`(kebab-case)。拡張子を `.spec.ts` にして Vitest のテストと区別する

#### helpers/

**役割**: エミュレータへの接続、複数のFirebaseアプリを作る補助、時計を進める補助など、`rules/`・`int/`・`e2e/` で使う共通の材料。

### docs/ (ドキュメントディレクトリ)

**配置ドキュメント**:
- `ideas/`: 壁打ち・アイデアメモ(`initial-requirements.md`)と、画面の資料の説明の下書き(`screens-README.md`。`design/screens/` ができる前の版。正式版は `design/screens/README.md` で、実装では、こちらを見ない)
- `design/`: 画面の資料(見本)
  - `design/screens/`: 日本語版(`README.md` と、`screens/*.html` の見本)
  - `design/screens-en/`: 英語版の見本(`screens/*.html`)
- `product-requirements.md`: プロダクト要求定義書
- `functional-design.md`: 機能設計書
- `architecture.md`: 技術仕様書
- `repository-structure.md`: リポジトリ構造定義書(本ドキュメント)
- `development-guidelines.md`: 開発ガイドライン
- `glossary.md`: ユビキタス言語定義
- `firebase-setup.md`: Firebase の準備の手順(プロジェクト作成、場所の選択、匿名認証、ルールの反映、環境変数。ユーザーが自分で行う作業)

## ファイル配置規則

### ソースファイル

| ファイル種別 | 配置先 | 命名規則 | 例 |
|------------|--------|---------|-----|
| ドメインの型 | `src/domain/`(分野ごとの型は各サブディレクトリ) | `types.ts` | `domain/types.ts`、`domain/schedule/types.ts` |
| ドメインの関数 | `src/domain/[分野]/` | camelCase(公開する主な関数名と同じ) | `roundClockAt.ts` |
| 設定値 | `src/domain/config/` | `defaultConfig.ts` | — |
| インフラのインターフェース | `src/infra/store/` | PascalCase | `GameStore.ts` |
| インフラの実装 | `src/infra/firebase/`・`src/infra/memory/` | PascalCase(クラス)/ camelCase(関数) | `FirebaseGameStore.ts` |
| アプリケーション層のクラス | `src/app/` | PascalCase | `RoundController.ts` |
| 文言 | `src/app/i18n/` | `messages.[言語].ts` | `messages.ja.ts` |
| UIの部品(クラス) | `src/ui/[種類]/` | PascalCase | `StageView.ts` |
| UIの描画関数 | `src/ui/[種類]/` | camelCase | `characterSvg.ts` |
| CSS | `src/ui/styles/` | kebab-case | `theme.css` |
| 開発用スクリプト | `scripts/` | kebab-case | `check-dist-size.ts` |

### テストファイル

| テスト種別 | 配置先 | 命名規則 | 例 |
|-----------|--------|---------|-----|
| ユニットテスト | `tests/unit/`(src と同じ構造) | `[対象].test.ts` | `pointsForPress.test.ts` |
| ルールのテスト | `tests/rules/` | `[対象].rules.test.ts` | `number.rules.test.ts` |
| 結合テスト | `tests/int/` | `[シナリオ].int.test.ts` | `concurrentPress.int.test.ts` |
| シミュレーション | `tests/sim/` | `[シナリオ].sim.test.ts` | `aiRounds.sim.test.ts` |
| E2Eテスト | `tests/e2e/` | `[シナリオ].spec.ts` | `full-round.spec.ts` |

### 設定ファイル

| ファイル種別 | 配置先 | 命名規則 |
|------------|--------|---------|
| ツールの設定 | プロジェクトルート | `[ツール名].config.ts`(既存の `eslint.config.js` と `.prettierrc` はそのままの名前で使う) |
| TypeScript の設定 | プロジェクトルート | `tsconfig.json` |
| Firebase の設定 | プロジェクトルート | `firebase.json`・`.firebaserc`・`database.rules.json` |
| 環境変数 | プロジェクトルート | `.env.example`(ひな形。Git 管理)・`.env.local`(本物。Git 管理外) |
| 仮の値(目標・倍率・時間・人数など) | `src/domain/config/defaultConfig.ts` | 1か所にまとめる(コードに直接書かない) |

- データベースのルールの中の数値(1周の長さ、ゲームの開始と終了、ポイントの猶予、20人、±50など)は、設定ファイルと同じ値にそろえる(ルールのファイルは、設定ファイルを読めないため)。値の対応は、`architecture.md` の「データベースの配置とセキュリティルール」にある
- 環境ごとの設定ファイル(開発・本番など)は作らない。切り替えは、環境変数だけで行う

## 命名規則

### ディレクトリ名

- **層のディレクトリ**: 単数形、小文字(`domain/`・`app/`・`ui/`・`infra/`)
- **分野・種類のディレクトリ**: 単数形、kebab-case(`schedule/`・`rooms/`・`stage/`)。ただし、同じ種類のものを並べる入れ物は複数形(`screens/`・`overlays/`・`styles/`・`personalities/`)

### ファイル名

- **クラス・インターフェースのファイル**: PascalCase(例: `RoundController.ts`、`GameStore.ts`)
- **関数のファイル**: camelCase(例: `roundClockAt.ts`、`validateName.ts`)
- **型だけのファイル**: `types.ts`
- **定数・文言のファイル**: camelCase(例: `defaultConfig.ts`、`messages.ja.ts`)。中の定数名は UPPER_SNAKE_CASE
- **CSS・スクリプト・E2Eテスト**: kebab-case

### テストファイル名

- ユニットテスト: `[テスト対象].test.ts`
- ルールのテスト: `[対象].rules.test.ts`
- 結合テスト: `[シナリオ].int.test.ts`
- シミュレーション: `[シナリオ].sim.test.ts`
- E2Eテスト: `[シナリオ].spec.ts`

## 依存関係のルール

### 層の間の依存

```
main.ts(組み立て。どの GameStore を使うかも、ここで決める)
    ↓
ui/ ──→ app/ ──→ domain/
 │        │          ↑
 │        └──→ infra/(インターフェースだけ) ──┘(型だけ)
 └──────────────→ domain/(型と純粋関数)

infra/firebase/ ──→ firebase/*(外部のライブラリ)
infra/memory/   ──→ domain/(型)
scripts/ ──→ (Node.js の標準のモジュールだけ)
tests/   ──→ 各層(テスト対象)
```

**禁止される依存**:
- `domain/` → `app/`・`ui/`・`infra/`・`firebase/*` (❌)
- `app/` → `ui/` (❌。`GameView` インターフェースを通す)
- `app/` → `infra/firebase/`・`infra/memory/` の実装 (❌。インターフェースだけを使い、実装は `main.ts` が渡す)
- `ui/` → `infra/`・`firebase/*` (❌)
- `infra/` → `app/`・`ui/` (❌)
- `scripts/` → `src/` のすべて (❌)

**強制の方法**: ESLint の `no-restricted-imports` を、ディレクトリごとの設定として `eslint.config.js` に書く(`architecture.md` の「層のルールの強制」)。`firebase/*` を import してよいのは、`src/infra/firebase/**` だけ。

### モジュール間の依存

- 循環依存を禁止する。2つのファイルが互いの型を必要とする場合は、型を `types.ts` に移す
- `domain/` の各分野の依存は、次の向きだけにする

```
ai/ ──→ targets/ ──→ config/
points/ ──→ targets/
   └─────→ schedule/ ──→ config/
judge/ ──→ targets/
rooms/ ──→ schedule/
pulses/ ──→ config/
ranking/・titles/・names/・layout/ ──→ types(型だけ)
```

- `ai/` は、範囲の判断(`targets/` の `isInRange`)を再利用する。AIの手の選択が、人間と同じ判断を、重複せずに使うため。AIのポイントの計算は、`ai/` ではなく、アプリケーション層の `AiHost` が `points/` を使って行う
- `points/` は、`targets/`(範囲内かの判断)と `schedule/`(倍増タイムの時刻)に依存する。逆の依存は作らない
- `layout/` は、見た目の計算(小人の並べ方、グラフの座標)だけを持ち、ルールの判断(`targets/` など)には依存しない。画面に出す形の計算を、ドメイン層に置くのは、ブラウザなしで、自動テストできるようにするため
- **確かめ方**: 分野の間の依存の向きは、ESLint では強制せず、コードレビューで確かめる(`development-guidelines.md` の「コードレビュー」)。層の間の依存は、上のとおり ESLint で強制する

## スケーリング戦略

### 機能の追加

| 将来の機能(PRD) | 追加する場所 |
|-----------|-------------|
| 振り返りグラフ(13) | `ui/graph/` に振り返り用の表示を足す。履歴を保存するなら、`infra/store/GameStore.ts` に読み書きを足す |
| ランキング(15) | `ui/screens/RankingScreen.ts` と、並べ替えの関数を `domain/ranking/` に足す。人数が増えたら、集計用のデータを、別に持つ |
| ルールの発展(16) | `domain/` の該当する分野(`points/`・`targets/`・`judge/`)に足す。ボタンの違いや役割は、`domain/types.ts` に型を足す |
| 不正対策(17) | `functions/`(新しいトップレベルのディレクトリ)に、サーバー側の関数を作り、`domain/judge/`・`domain/points/` の純粋な関数を、そのまま使う |
| 端末の引き継ぎ(18) | `infra/firebase/auth.ts` に、Googleログインなどの連携を足す。`ui/screens/MyPageScreen.ts` に、導線を足す |
| イベント用の大画面モード(19) | `src/ui/display/` を新しく作り、`RoundView` を、大画面用に描く。URLで、部屋を指定して開く形にする |
| 専用コントローラーと大画面(20) | `src/infra/controller/` を新しく作り、操作(「どの席が、+1か−1か、何回分か」)を、`PressBatcher` の入力として受け取る |
| 部屋の均等な分け直し | `domain/rooms/rebalance.ts` を足す |
| 20人そろったら早く始める | `app/RoundController.ts` に処理を足し、条件付きの書き込みを `infra/store/GameStore.ts` に足す |
| 言語の追加 | `app/i18n/messages.[言語].ts` を足し、`keys.ts` の言語の型に加える |
| 称号の追加 | `domain/titles/titleOf.ts` と、設定値、`messages.*.ts` に足す |
| AIの性格の追加 | `domain/ai/personalities/` にファイルを足し、`decide.ts` と `aiParams.ts` に登録する。名前を `messages.*.ts` に足す |

### ファイルサイズの管理

- 1ファイル300行以下を目安とする。300行を超えたら分割を検討し、500行を超えたら分割する
- 特に `RoundController.ts` と `FirebaseGameStore.ts` は大きくなりやすいので、段階(集合中・プレイ中・結果発表)や、扱うデータ(部屋・回・数字・合図・ポイント)ごとに、ファイルを分ける
- `messages.ja.ts` と `messages.en.ts` は、文言が多いので、画面ごとに分けることを検討する(例: `messages/setup.ja.ts`)

## 特殊ディレクトリ

### .steering/ (ステアリングファイル)

**役割**: 特定の開発作業における「今回何をするか」を定義する。

**構造**:
```
.steering/
└── [YYYYMMDD]-[task-name]/
    ├── requirements.md      # 今回の作業の要求内容
    ├── design.md            # 変更内容の設計
    └── tasklist.md          # タスクリスト
```

**命名規則**: `20261010-add-schedule` 形式

- 中身は Git で管理しない(`.gitkeep` だけを管理する。既存の `.gitignore` の設定)

### .github/ (GitHub Actions)

**役割**: CIの設定(`development-guidelines.md` の「CI」)。

**構造**:
```
.github/
└── workflows/
    └── ci.yml               # check・build・rules・int・e2e・sim のジョブ
```

- ジョブは1つのファイルにまとめ、ジョブごとに実行する条件(すべての push、`main` への push だけ、特定のディレクトリの変更だけ)を設定する
- ルールのテスト・結合テスト・E2Eテストは、Emulator Suite を使うので、Java(11以上)のセットアップが必要

### .claude/ (Claude Code の設定)

**役割**: Claude Code の設定とカスタマイズ。

**構造**:
```
.claude/
├── commands/                # スラッシュコマンド
├── skills/                  # 作業の種類ごとのスキル(steering/templates を含む)
├── agents/                  # サブエージェントの定義
└── settings.json            # 共有の設定(settings.local.json は Git 管理外)
```

## 除外設定

### .gitignore

既存の設定に加えて、次を除外する。

| 対象 | 理由 |
|------|------|
| `.env.local` | Firebase の接続の設定の実物(環境ごと) |
| `emulator-data/` | Emulator Suite の保存したデータ |
| `release/` | itch.io用のzip |
| `test-results/`・`playwright-report/` | Playwright の出力 |

既存の設定で除外済みのもの: `node_modules/`・`dist/`・`coverage/`・`.env`・`*.log`・`.steering/` の中身・`.claude/settings.local.json` など。

- `.env.example` は、ひな形なので、Git で管理する(本物の値は入れない)
- Firebase の API キーは、公開される前提だが、`.env.local` に置いて、リポジトリには入れない(環境ごとに切り替えるため)

### .prettierignore・ESLint の除外

次をツールの対象から外す。

- `dist/`・`node_modules/`・`coverage/`・`.steering/`・`release/`
- `emulator-data/`
- `test-results/`・`playwright-report/`
- `docs/design/`(画面の見本のHTML。そのまま保つ)

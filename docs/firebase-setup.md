# Firebase の準備の手順

本番の Firebase プロジェクトを用意する手順。**ユーザー(開発者)が、自分で行う作業**。開発とテストは、Emulator Suite だけで進められるので、この作業が終わっていなくても、実装は進められる(`docs/development-guidelines.md` の「作業の進め方」)。

技術的な構成は `docs/architecture.md` の「Firebase の構成」を正とする。

## 1. プロジェクトを作る

1. [Firebase コンソール](https://console.firebase.google.com/) で、プロジェクトを作る(Google アナリティクスは使わない)
2. プランは、無料の Spark のままにする

## 2. Realtime Database を作る

1. 「構築 > Realtime Database」で、データベースを作る
2. 場所は、**シンガポール(`asia-southeast1`)** を選ぶ。**作ったあとは、変更できない**
3. セキュリティルールは、「ロックモード」で始める(あとで、`database.rules.json` を反映する)

## 3. 匿名認証をオンにする

1. 「構築 > Authentication > ログイン方法」で、「匿名」だけを有効にする
2. ほかのログイン方法は、有効にしない

## 4. ウェブアプリを登録して、接続の設定を写す

1. 「プロジェクトの設定 > マイアプリ」で、ウェブアプリを追加する(Firebase Hosting は使わない)
2. 表示された設定の値を、`.env.local` に写す(`.env.example` をコピーして作る)

| `.env.local` の名前 | Firebase の設定の名前 |
|------|------|
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_DATABASE_URL` | `databaseURL`(`https://…asia-southeast1.firebasedatabase.app`) |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_APP_ID` | `appId` |

3. 本番につなぐときは、`VITE_USE_EMULATOR` を消すか、`false` にする

- API キーは、ブラウザ側のコードに入る前提で、秘密ではない。守りは、セキュリティルールで行う
- `.env.local` は、Git で管理しない(`.gitignore` 済み)

## 5. Firebase CLI を、本番のプロジェクトにつなぐ

```bash
npx firebase login
npx firebase use --add   # 作ったプロジェクトを選び、別名を prod にする
```

- `.firebaserc` の `default` は、エミュレータ専用の `demo-number-together` のままにする(`demo-` で始まるプロジェクトは、本番につながらないので、テストで本番のデータを触る心配がない)
- 本番に反映するときだけ、`--project prod` を付ける

## 6. セキュリティルールを反映する

```bash
npm run test:rules                                   # 先に、ルールのテストを通す
npx firebase deploy --only database --project prod
```

- 反映したあと、Firebase コンソールの「Realtime Database > ルール」で、`database.rules.json` と同じ内容になっていることを確かめる
- **ルールの中の数値は、設定ファイル(`src/domain/config/defaultConfig.ts`)と同じ値にそろえる。** 対応は `docs/architecture.md` の「データベースの配置とセキュリティルール」にある。設定の値を変えたら、ルールも直し、`npm run test:rules` と `npm test`(値の一致を確かめるテストがある)を通してから、反映する
- 不具合で戻すときは、直前のバージョンのタグの `database.rules.json` を、同じ手順で反映する

## 7. 公開したあと

- 公開後1週間は毎日、そのあとは週に1回、コンソールで、同時接続とダウンロード量を見る(`docs/architecture.md` の「運用と費用」)
- 同時接続が80前後、またはダウンロード量が月の上限の7割を超えそうなら、有料の Blaze への切り替えを検討する。切り替えたら、予算の通知を設定する

/**
 * 日本語の文言の一覧(画面の見本 docs/design/screens/screens/ の文言)。
 *
 * キーは、この一覧が正。英語(messages.en.ts)は、同じキーをすべて持つ(型で強制する)。
 * 引数は {name} の形で書き、t(key, { name }) で埋める。
 */
export const ja = {
  'lang.switch': 'English', // 切り替えた先の言語名

  'connecting.title': 'つないでいます…',

  'setup.title': 'はじめまして!',
  'setup.lead': '名前とキャラクターを、えらんでね',
  'setup.nameLabel': 'なまえ(全角6文字・半角12文字まで)',
  'setup.nameNote': 'ほかの人にも見えるよ',
  'setup.count': '{used} / {max}',
  'setup.hair': 'かみがた',
  'setup.shirt': 'ふくの色',
  'setup.accessory': 'こもの',
  'setup.none': 'なし',
  'setup.random': 'おまかせ',
  'setup.decide': 'これできまり!',
  'setup.warning':
    'ブラウザのデータを消したり、ほかの端末で開いたりすると、べつの人として扱われて、実績は引き継がれません。',

  'wait.full.title': 'いまは満員だよ',
  'wait.lastMinute.title': 'もうすぐ終わるよ',
  'wait.lastMinute.lead': '終了の1分前からは、途中参加できません',
  'wait.afterOffline.title': 'つぎの回から参加するよ',
  'wait.afterOffline.lead': 'つながらないあいだに、回が進みました',
  'wait.next': 'つぎの回まで',
  'wait.note': '時間になったら、そのまま参加できます',
  'wait.waiting': '待っています',

  'offline.title': 'つながらない…',
  'offline.lead': '電波のいいところで、ためしてね',
  'offline.reconnecting': 'つなぎ直しています',
  'offline.attempt': '{n}回目のトライ中',
  'offline.note1': 'つながったら、続きから参加できます',
  'offline.note1b': '(終了の1分前まで)',
  'offline.note2': '1分以上つながらないと次の回から参加になります',
  'offline.retry': 'いますぐ、つなぎ直す',

  'busy.title': 'いま混み合ってるよ',
  'busy.lead': 'たくさんの人が遊んでいます',
  'busy.ask': '少し待ってから、もう一度ためしてね',
  'busy.auto': '自動でためします',
  'busy.remaining': 'あと {s}秒',
  'busy.retry': 'いますぐ、ためす',

  'phase.gathering': '集合中',
  'phase.playing': 'ゲーム中',
  'phase.result': '結果発表',
  'room.target': '目標',
  'room.myPoints': 'あなたのポイント',
  'room.inRange': '範囲内!',
  'room.outOfRange': '範囲外',

  'error.title': 'エラーが起きました',
  'error.lead': 'ページを再読み込みしてください',
  'error.reload': '再読み込み',
} as const;

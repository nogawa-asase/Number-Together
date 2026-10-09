import type { Messages } from './keys';

/**
 * 英語の文言の一覧(画面の見本 docs/design/screens-en/screens/ の文言)。
 * 日本語をもとに、短く、やさしい英語にする。日本語にあるキーは、すべて持つ(型で強制する)。
 */
export const en: Messages = {
  'lang.switch': '日本語',

  'connecting.title': 'Connecting…',

  'setup.title': 'Welcome!',
  'setup.lead': 'Pick a name and a character',
  'setup.nameLabel': 'Name (12 letters max)',
  'setup.nameNote': 'Others can see it',
  'setup.count': '{used} / {max}',
  'setup.hair': 'Hair',
  'setup.shirt': 'Shirt color',
  'setup.accessory': 'Accessory',
  'setup.none': 'None',
  'setup.random': 'Random',
  'setup.decide': 'This one!',
  'setup.warning':
    "If you clear your browser data or open this on another device, you'll be treated as a new player and your records won't carry over.",

  'wait.full.title': "We're full right now",
  'wait.lastMinute.title': 'Almost over',
  'wait.lastMinute.lead': 'No joining in the last minute',
  'wait.afterOffline.title': "You'll join the next round",
  'wait.afterOffline.lead': 'The round moved on while you were offline',
  'wait.next': 'Next round in',
  'wait.note': "You'll join as soon as the next round starts",
  'wait.waiting': 'Waiting',

  'offline.title': 'No connection…',
  'offline.lead': 'Try somewhere with a better signal',
  'offline.reconnecting': 'Reconnecting',
  'offline.attempt': 'Attempt {n}',
  'offline.note1': 'Once connected, you can rejoin',
  'offline.note1b': '(until the last minute)',
  'offline.note2':
    "If you're offline for over a minute, you'll join the next round",
  'offline.retry': 'Retry now',

  'busy.title': "It's crowded",
  'busy.lead': 'Lots of people are playing',
  'busy.ask': 'Please wait a bit and try again',
  'busy.auto': 'Retrying automatically',
  'busy.remaining': '{s}s',
  'busy.retry': 'Try now',

  'phase.gathering': 'Gathering',
  'phase.playing': 'Playing',
  'phase.result': 'Results',
  'room.target': 'Target',
  'room.myPoints': 'Your points',
  'room.inRange': 'In range!',
  'room.outOfRange': 'Out of range',

  'error.title': 'Something went wrong',
  'error.lead': 'Please reload the page',
  'error.reload': 'Reload',
};

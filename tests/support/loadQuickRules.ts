import { resetEmulator } from './emulator';

// 同じ Wi-Fi の実機で、短い周期(1周10秒)で試すとき(npm run dev:lan:quick)。
// 起動したエミュレータを空にし、ルールの時刻の数値を、短い周期に置き換えて読み込ませる
await resetEmulator();
console.log('エミュレータに、短い周期(1周10秒)のルールを読み込ませました');

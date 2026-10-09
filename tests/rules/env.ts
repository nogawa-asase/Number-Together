import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { scaledRules } from '../support/testCycle';

/** エミュレータの設定(firebase.json と同じ) */
const DATABASE = { host: '127.0.0.1', port: 9000 };

/** 短い周期のルールを読み込ませた、テストの環境を作る */
export function rulesEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: 'demo-number-together',
    database: { ...DATABASE, rules: scaledRules() },
  });
}

/** データベースの場所の参照(compat の API) */
export type Db = ReturnType<
  ReturnType<RulesTestEnvironment['authenticatedContext']>['database']
>;

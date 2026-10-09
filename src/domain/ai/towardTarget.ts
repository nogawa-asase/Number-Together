import type { AiView } from './aiView';
import type { AiMove } from './types';

/** 見ている数字を、目標に近づける向き。ちょうど目標なら null */
export function towardTarget(view: AiView): AiMove {
  if (view.number < view.target) return '+1';
  if (view.number > view.target) return '-1';
  return null;
}

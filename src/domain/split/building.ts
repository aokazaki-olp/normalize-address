/**
 * building.ts
 *
 * @description 切れ目より後ろのテキストから建物部を取り出す
 */

import { LEADING_BARS } from './rules.ts';

/**
 * 切れ目より後ろのテキストから建物部を取り出す（docs/design.md の手順7）
 *
 * @param text - 切れ目より後ろのテキスト
 * @returns 建物部。空なら建物部は無い
 */
export const toBuilding = (text: string): string =>
  text.trim().replace(LEADING_BARS, '').trim();

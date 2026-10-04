/**
 * building.ts
 *
 * @description 切れ目より後ろのテキストから建物部を取り出す
 */

import {
  BARE_FLOOR_OR_ROOM_MARK,
  LEADING_BARS,
  LEADING_SPACE,
} from './rules.ts';

/**
 * 切れ目より後ろのテキストから建物部を取り出す（docs/design.md の手順7）
 *
 * @param text - 切れ目より後ろのテキスト
 * @returns 建物部。空なら建物部は無い
 */
export const toBuilding = (text: string): string =>
  text.trim().replace(LEADING_BARS, '').trim();

/**
 * 切れ目より後ろが、階・部屋の数字を番地に取った残りの印か（docs/design.md の手順4・6）
 *
 * @param after - 切れ目より後ろのテキスト
 * @returns 利用者の空白で始まらず、建物部が `階` か、直後が末尾・空白・`・` `、` `,` `(` の `F`・`号室` で始まれば true
 */
export const isLeftoverMark = (after: string): boolean =>
  !LEADING_SPACE.test(after) && BARE_FLOOR_OR_ROOM_MARK.test(toBuilding(after));

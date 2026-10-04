/**
 * building.ts
 *
 * @description 切れ目より後ろのテキストから建物部を取り出す
 */

import { BARE_FLOOR_OR_ROOM_MARK, LEADING_BARS } from './rules.ts';

/**
 * 切れ目より後ろのテキストから建物部を取り出す（docs/design.md の手順7）
 *
 * @param text - 切れ目より後ろのテキスト
 * @returns 建物部。空なら建物部は無い
 */
export const toBuilding = (text: string): string =>
  text.trim().replace(LEADING_BARS, '').trim();

/**
 * 建物部が数字の無い階・部屋の印で始まるか（docs/design.md の手順4・6）
 *
 * @param building - 建物部
 * @returns `階` か、直後が末尾・空白・`・` `、` `,` `(` の `F`・`号室` で始まれば true。階・部屋の数字が番地に取られた残りで、建物部にしない
 */
export const startsWithBareMark = (building: string): boolean =>
  BARE_FLOOR_OR_ROOM_MARK.test(building);

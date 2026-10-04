/**
 * spaces.ts
 *
 * @description 住所の番号の中にある空白を消す
 */

import { SPACE_IN_NUMBER } from './rules.ts';

/**
 * 住所の番号の中にある空白を消す（docs/design.md の手順1）
 *
 * @param text - ガード付き NFKC をかけたテキスト
 * @returns 横棒のまわり、番のあとの号で閉じた番号の前、番号のあとの接尾語だけの前の空白を消したテキスト
 */
export const removeSpacesInNumber = (text: string): string =>
  text.replace(SPACE_IN_NUMBER, '');

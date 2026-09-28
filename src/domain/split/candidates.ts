/**
 * candidates.ts
 *
 * @description 住所部と建物部の切れ目の候補
 */

import { BEFORE_ANY, BEFORE_NON_NUMBER, NUMBER_PART } from './rules.ts';

/**
 * 切れ目の候補の位置を前から順に返す
 *
 * 直前が号・地の位置と、直前が数字・漢数字・番・目で直後が数字・号・番・地でない位置。テキストの先頭と末尾は含めない。
 *
 * @param text - ガード付き NFKC をかけたテキスト
 * @returns 候補の位置（UTF-16 のインデックス）
 */
export const splitCandidates = (text: string): number[] => {
  const positions: number[] = [];
  for (let i = 1; i < text.length; i++) {
    const before = text.charAt(i - 1);
    if (
      BEFORE_ANY.test(before) ||
      (BEFORE_NON_NUMBER.test(before) && !NUMBER_PART.test(text.charAt(i)))
    ) {
      positions.push(i);
    }
  }
  return positions;
};

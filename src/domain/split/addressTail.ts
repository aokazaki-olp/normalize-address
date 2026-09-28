/**
 * addressTail.ts
 *
 * @description 全体の住所の末尾と残り、前半の住所の末尾
 */

import type { ParsedAddress } from '../../ports/addressParser.ts';
import { LEADING_NUMBER, LEADING_SUFFIX, TRAILING_SUFFIX } from './rules.ts';

/** 住所の末尾と、その後ろに残ったテキスト */
export interface AddressTail {
  tail: string;
  rest: string;
}

/**
 * 全体の結果から、住所の末尾と残りを決める
 *
 * level 8 なら block が末尾で unmatched が残り。それ以外は unmatched の先頭の番地らしい部分が末尾で、
 * その直後の号・番地・番・地も残りから除く。
 *
 * @param whole - テキスト全体の解析の結果（level 3 以上）
 * @returns 住所の末尾と残り
 */
export const wholeTail = (whole: ParsedAddress): AddressTail => {
  const tail =
    whole.level === 8
      ? (whole.block ?? '')
      : (LEADING_NUMBER.exec(whole.unmatched)?.[0] ?? '');
  const afterTail =
    whole.level === 8 ? whole.unmatched : whole.unmatched.slice(tail.length);
  const rest = tail === '' ? afterTail : afterTail.replace(LEADING_SUFFIX, '');
  return { tail, rest };
};

/**
 * 前半の結果から、前半の住所の末尾を作る
 *
 * @param front - 前半の解析の結果
 * @returns block と、末尾の住所の接尾語を落とした unmatched を - でつないだもの
 */
export const frontTail = (front: ParsedAddress): string =>
  [front.block ?? '', front.unmatched.replace(TRAILING_SUFFIX, '')]
    .filter((part) => part !== '')
    .join('-');

/** 全体の結果と、そこから1回だけ導く住所の末尾と残り */
export interface WholeContext extends AddressTail {
  whole: ParsedAddress;
}

/**
 * 全体の結果から、切れ目の判定に使う文脈を作る
 *
 * @param whole - テキスト全体の解析の結果（level 3 以上）
 * @returns 全体の結果と、その住所の末尾と残り
 */
export const wholeContext = (whole: ParsedAddress): WholeContext => ({
  whole,
  ...wholeTail(whole),
});

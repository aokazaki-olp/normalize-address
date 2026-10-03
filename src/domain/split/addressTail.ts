/**
 * addressTail.ts
 *
 * @description 全体の住所の末尾と残り、前半の住所の末尾
 */

import type { ParsedAddress } from '../../ports/addressParser.ts';
import {
  LEADING_SUFFIX,
  LEADING_TAIL_NUMBER,
  NON_DIGITS,
  TRAILING_SUFFIX,
} from './rules.ts';

const leadingTailNumber = (text: string): string =>
  LEADING_TAIL_NUMBER.exec(text)?.[0] ?? '';

const hyphenate = (numberPart: string): string =>
  numberPart.replace(NON_DIGITS, '-');

/** 住所の末尾と、その後ろに残ったテキスト */
export interface AddressTail {
  readonly tail: string;
  readonly rest: string;
}

/**
 * 全体の結果から、住所の末尾と残りを決める（docs/design.md の手順5）
 *
 * @param whole - テキスト全体の解析の結果（level 3 以上）
 * @returns 住所の末尾と残り
 */
export const wholeTail = (whole: ParsedAddress): AddressTail => {
  const numberPart = leadingTailNumber(whole.unmatched);
  const tail = whole.level === 8 ? (whole.block ?? '') : hyphenate(numberPart);
  const afterTail =
    whole.level === 8
      ? whole.unmatched
      : whole.unmatched.slice(numberPart.length);
  const rest = tail === '' ? afterTail : afterTail.replace(LEADING_SUFFIX, '');
  return { tail, rest };
};

/**
 * 前半の結果から、前半の住所の末尾を作る（docs/design.md の手順7）
 *
 * @param front - 前半の解析の結果
 * @returns 前半の住所の末尾
 */
export const frontTail = (front: ParsedAddress): string => {
  const unmatched = front.unmatched.replace(TRAILING_SUFFIX, '');
  const numberPart = leadingTailNumber(unmatched);
  return [
    front.block ?? '',
    hyphenate(numberPart) + unmatched.slice(numberPart.length),
  ]
    .filter((part) => part !== '')
    .join('-');
};

/** 全体の結果と、そこから1回だけ導く住所の末尾と残り */
export interface WholeContext extends AddressTail {
  readonly whole: ParsedAddress;
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

/**
 * acceptance.ts
 *
 * @description 建物部の始まりの位置で切った前半の受け入れ条件と、前半が全体と同じ住所を指すかの判定
 */

import type { ParsedAddress } from '../../ports/addressParser.ts';
import { frontTail, type WholeContext } from './addressTail.ts';
import {
  CONTINUES_ADDRESS,
  ENDS_AS_ADDRESS,
  FLOOR_AFTER_BAR,
  FLOOR_AFTER_SPACE,
  FRONT_UNMATCHED,
  LEADING_BARS,
  LEADING_DIGIT,
  LEADING_DIGITS,
  LEADING_KANJI_NUMERAL,
  LEADING_SPACE,
  ROOM,
  SUFFIX_ONLY,
} from './rules.ts';

/** 建物部の始まりの位置から後ろのテキストと、そこから取り出した建物部 */
export interface BuildingSide {
  readonly after: string;
  readonly building: string;
}

/**
 * 前半の結果が、全体の結果と同じ住所を指すかを判定する
 *
 * 都道府県・市区町村・町字と住所の末尾を比べる。前半の住所の末尾は block と、
 * 末尾の号・番地・番・地を落とした unmatched を - でつないだもの。
 *
 * @param context - 全体の結果と、その住所の末尾
 * @param front - 切れ目の候補までの前半の解析の結果
 * @returns 一致すれば true
 */
export const isSameAddress = (
  context: WholeContext,
  front: ParsedAddress,
): boolean =>
  isSameArea(context.whole, front) && frontTail(front) === context.tail;

const isSameArea = (whole: ParsedAddress, front: ParsedAddress): boolean =>
  front.prefecture === whole.prefecture &&
  front.city === whole.city &&
  front.town === whole.town;

const hasAddressLevel = (front: ParsedAddress): boolean => front.level >= 3;

const hasFrontTail = (tail: string): boolean => tail !== '';

const readsThrough = (context: WholeContext, front: ParsedAddress): boolean => {
  const unmatched = front.unmatched.trim();
  if (context.tail !== '') {
    return front.level === 8
      ? unmatched === '' || SUFFIX_ONLY.test(unmatched)
      : unmatched === '' || FRONT_UNMATCHED.test(unmatched);
  }
  return (
    context.whole.unmatched.trim().startsWith(unmatched) &&
    ENDS_AS_ADDRESS.test(unmatched)
  );
};

const continuesAfterBar = (after: string, building: string): boolean =>
  LEADING_BARS.test(after.trim()) &&
  LEADING_DIGIT.test(building) &&
  !FLOOR_AFTER_BAR.test(building) &&
  !ROOM.test(building);

const doesNotContinue = ({ after, building }: BuildingSide): boolean =>
  !CONTINUES_ADDRESS.test(building) && !continuesAfterBar(after, building);

const continuesWholeNumber = (
  context: WholeContext,
  tail: string,
  building: string,
): boolean => {
  const digits = LEADING_DIGITS.exec(building)?.[0];
  return (
    digits !== undefined &&
    !FLOOR_AFTER_SPACE.test(building) &&
    context.tail === `${tail}-${digits}`
  );
};

const keepsWholeNumber = (
  context: WholeContext,
  front: ParsedAddress,
  tail: string,
  { after, building }: BuildingSide,
): boolean =>
  context.whole.level !== 8 ||
  front.level === 8 ||
  LEADING_KANJI_NUMERAL.test(building) ||
  (LEADING_SPACE.test(after) && !continuesWholeNumber(context, tail, building));

/**
 * 建物部の始まりの位置で切った前半と後半を、住所と建物部として受け入れるかを判定する
 *
 * docs/design.md の手順4の受け入れ条件（地域一致・level 3 以上・末尾あり・読み切り・続きでない・番地の保持）をすべて満たすときだけ受け入れる。
 *
 * @param context - 全体の結果と、その住所の末尾
 * @param front - 建物部の始まりの位置までの前半の解析の結果
 * @param side - 建物部の始まりの位置から後ろのテキストと、そこから取り出した建物部
 * @returns 受け入れるなら true
 */
export const isAddressFront = (
  context: WholeContext,
  front: ParsedAddress,
  side: BuildingSide,
): boolean => {
  const tail = frontTail(front);
  return (
    isSameArea(context.whole, front) &&
    hasAddressLevel(front) &&
    hasFrontTail(tail) &&
    readsThrough(context, front) &&
    doesNotContinue(side) &&
    keepsWholeNumber(context, front, tail, side)
  );
};

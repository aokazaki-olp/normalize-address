/**
 * acceptance.ts
 *
 * @description 建物部の始まりの位置で切った前半の受け入れ条件と、前半が全体と同じ住所を指すかの判定
 */

import type { ParsedAddress } from '../../ports/addressParser.ts';
import {
  exceedsNumberLimit,
  frontTail,
  type WholeContext,
} from './addressTail.ts';
import {
  ADDRESS_LIST,
  ADDRESS_MODIFIER,
  DAI_BRANCH,
  CONTINUES_ADDRESS,
  ENDS_AS_ADDRESS,
  FLOOR_AFTER_BAR,
  FLOOR_AFTER_SPACE,
  FLOOR_MARK_ONLY,
  FRONT_UNMATCHED,
  LEADING_BARS,
  LEADING_DIGIT,
  LEADING_DIGITS,
  LEADING_KANJI_NUMERAL,
  LEADING_SPACE,
  LOT_END,
  ROOM,
  SUFFIX_ONLY,
  FLOOR_DIGIT_END,
} from './rules.ts';

/** 建物部の始まりの位置から後ろのテキストと、そこから取り出した建物部 */
export interface BuildingSide {
  /** 建物部の始まりの位置より前のテキスト（無ければ ''） */
  readonly before?: string;
  readonly after: string;
  readonly building: string;
}

/**
 * 前半の結果が、全体の結果と同じ住所を指すかを判定する（docs/design.md の手順6）
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

/**
 * 建物部が住所の続き（地番の列挙・合併、甲乙・第の枝番）か、住所の範囲の接尾語（地先・地内など）だけかを判定する（docs/design.md の手順4・6）
 *
 * @param building - 後半から取り出した建物部
 * @param before - 切れ目より前のテキスト。`N番地`・`N番` で終わるなら、`第N`（`第N号`）を枝番とみなす
 * @returns 住所の続きだけなら true
 */
export const isAddressOnly = (building: string, before = ''): boolean =>
  ADDRESS_LIST.test(building) ||
  ADDRESS_MODIFIER.test(building) ||
  (LOT_END.test(before) && DAI_BRANCH.test(building));

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
 * 建物部の始まりの位置で切った前半と後半を受け入れるかを判定する（docs/design.md の手順4の受け入れ条件）
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
): boolean =>
  acceptsFront(context, front, side) &&
  !isAddressOnly(side.building, side.before);

/**
 * 建物部の始まりの位置で切った後半が住所の続きだけで、そのほかの受け入れ条件は満たすかを判定する（docs/design.md の手順4・8）
 *
 * @param context - 全体の結果と、その住所の末尾
 * @param front - 建物部の始まりの位置までの前半の解析の結果
 * @param side - 建物部の始まりの位置から後ろのテキストと、そこから取り出した建物部
 * @returns 後半が住所の続きだけで、ほかの受け入れ条件を満たすなら true
 */
export const isAddressOnlyAfterFront = (
  context: WholeContext,
  front: ParsedAddress,
  side: BuildingSide,
): boolean =>
  isAddressOnly(side.building, side.before) &&
  acceptsFront(context, front, side);

const acceptsFront = (
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
    keepsWholeNumber(context, front, tail, side) &&
    !exceedsNumberLimit(front, side.after, context.thirdIsLot)
  );
};

/**
 * level 3 の切れ目で建物部が階の印だけになるとき、番号の最後の1桁を階に回すかを判定する（docs/design.md の手順6）
 *
 * @param context - 全体の結果と、その住所の末尾
 * @param before - 切れ目より前のテキスト
 * @param after - 切れ目より後ろのテキスト
 * @returns 全体が level 8 未満で、後ろが空白なしの `F`・`階` だけで、前が2桁以上の数字で終わり、最後の1字が 0 でないなら true
 */
export const movesFloorDigit = (
  context: WholeContext,
  before: string,
  after: string,
): boolean =>
  context.whole.level !== 8 &&
  FLOOR_MARK_ONLY.test(after) &&
  FLOOR_DIGIT_END.test(before);

/**
 * 最後の1桁を階に回した前半が、全体と同じ住所を指すかを判定する（docs/design.md の手順6）
 *
 * @param context - 全体の結果と、その住所の末尾
 * @param front - 最後の1桁を除いた前半の解析の結果
 * @returns 前半が level 8 で、地域が一致し、前半の住所の末尾が全体の住所の末尾から最後の1桁を除いたものと一致すれば true
 */
export const isSameAddressWithoutLastDigit = (
  context: WholeContext,
  front: ParsedAddress,
): boolean =>
  front.level === 8 &&
  isSameArea(context.whole, front) &&
  frontTail(front) === context.tail.slice(0, -1);

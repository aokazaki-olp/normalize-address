/**
 * acceptance.ts
 *
 * @description 建物部の始まりの位置で切った前半の受け入れ条件と、前半が全体と同じ住所を指すかの判定
 */

import type { ParsedAddress } from '../../ports/addressParser.ts';
import { frontTail, wholeTail } from './addressTail.ts';
import { toBuilding } from './building.ts';
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

/**
 * 前半の結果が、全体の結果と同じ住所を指すかを判定する
 *
 * 都道府県・市区町村・町字と住所の末尾を比べる。前半の住所の末尾は block と、
 * 末尾の号・番地・番・地を落とした unmatched を - でつないだもの。
 *
 * @param whole - テキスト全体の解析の結果
 * @param tail - 全体の住所の末尾
 * @param front - 切れ目の候補までの前半の解析の結果
 * @returns 一致すれば true
 */
export const isSameAddress = (
  whole: ParsedAddress,
  tail: string,
  front: ParsedAddress,
): boolean => isSameArea(whole, front) && frontTail(front) === tail;

const isSameArea = (whole: ParsedAddress, front: ParsedAddress): boolean =>
  front.prefecture === whole.prefecture &&
  front.city === whole.city &&
  front.town === whole.town;

const readsThrough = (whole: ParsedAddress, front: ParsedAddress): boolean => {
  const unmatched = front.unmatched.trim();
  if (wholeTail(whole).tail !== '') {
    return front.level === 8
      ? unmatched === '' || SUFFIX_ONLY.test(unmatched)
      : unmatched === '' || FRONT_UNMATCHED.test(unmatched);
  }
  return (
    whole.unmatched.trim().startsWith(unmatched) &&
    ENDS_AS_ADDRESS.test(unmatched)
  );
};

const continuesWholeNumber = (
  whole: ParsedAddress,
  front: ParsedAddress,
  building: string,
): boolean => {
  const digits = LEADING_DIGITS.exec(building)?.[0];
  return (
    digits !== undefined &&
    !FLOOR_AFTER_SPACE.test(building) &&
    wholeTail(whole).tail === `${frontTail(front)}-${digits}`
  );
};

const continuesAfterBar = (after: string, building: string): boolean =>
  LEADING_BARS.test(after.trim()) &&
  LEADING_DIGIT.test(building) &&
  !FLOOR_AFTER_BAR.test(building) &&
  !ROOM.test(building);

const keepsWholeNumber = (
  whole: ParsedAddress,
  front: ParsedAddress,
  after: string,
  building: string,
): boolean =>
  whole.level !== 8 ||
  front.level === 8 ||
  LEADING_KANJI_NUMERAL.test(building) ||
  (LEADING_SPACE.test(after) && !continuesWholeNumber(whole, front, building));

/**
 * 建物部の始まりの位置で切った前半と後半を、住所と建物部として受け入れるかを判定する
 *
 * 次のすべてを満たすときだけ受け入れる。都道府県・市区町村・町字が全体の結果と一致し、level が 3 以上で、
 * 前半の住所の末尾が空でない。前半が住所として読み切れている。建物部が住所の続き（番・号・の など＋数字、線）で
 * 始まらず、横棒の後ろの数字が階・部屋番号の形でないもの（枝番）でもない。全体が level 8 で前半が level 8 未満なら、建物部が漢数字で始まるか、
 * 後半が空白で始まり建物部の先頭の数字が全体の番地の続きでない（階の形なら続きとみなさない）。
 *
 * @param whole - テキスト全体の解析の結果
 * @param front - 建物部の始まりの位置までの前半の解析の結果
 * @param after - 建物部の始まりの位置から後ろのテキスト
 * @returns 受け入れるなら true
 */
export const isAddressFront = (
  whole: ParsedAddress,
  front: ParsedAddress,
  after: string,
): boolean => {
  const building = toBuilding(after);
  return (
    isSameArea(whole, front) &&
    front.level >= 3 &&
    frontTail(front) !== '' &&
    readsThrough(whole, front) &&
    !CONTINUES_ADDRESS.test(building) &&
    !continuesAfterBar(after, building) &&
    keepsWholeNumber(whole, front, after, building)
  );
};

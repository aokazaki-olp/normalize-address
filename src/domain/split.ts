/**
 * split.ts
 *
 * @description 住所部と建物部の切れ目の候補と、解析の結果の比較
 */

import type { ParsedAddress } from '../ports/addressParser.ts';
import type { SplitStatus } from '../ports/addressResult.ts';

// 漢数字は NJA 3.1.3 の正規表現が対象にする字（docs/nja-3.1.3-char-rules.md）
const BEFORE_ANY = /^[号地]$/u;
const BEFORE_NON_NUMBER = /^[0-9〇一二三四五六七八九十百千番目]$/u;
const NUMBER_PART = /^[0-9号番地]$/u;
const LEADING_NUMBER = /^[0-9]+(?:-[0-9]+)*/u;
const LEADING_SUFFIX = /^(?:号|番地|番|地)/u;
const TRAILING_SUFFIX = /(?:号|番地|番|地)$/u;
const LEADING_HYPHENS = /^-+/u;

/** 切れ目の探索の結果 */
export interface SplitOutcome {
  split: SplitStatus;
  other: string;
  building: string;
}

/** 住所の末尾と、その後ろに残ったテキスト */
export interface AddressTail {
  tail: string;
  rest: string;
}

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

/**
 * 全体の結果から、住所の末尾と残りを決める
 *
 * level 8 なら number が末尾で other が残り。それ以外は other の先頭の番地らしい部分が末尾で、
 * その直後の号・番地・番・地も残りから除く。
 *
 * @param whole - テキスト全体の解析の結果（level 3 以上）
 * @returns 住所の末尾と残り
 */
export const wholeTail = (whole: ParsedAddress): AddressTail => {
  if (whole.level === 8) {
    return { tail: whole.number ?? '', rest: whole.other };
  }
  const tail = LEADING_NUMBER.exec(whole.other)?.[0] ?? '';
  const afterTail = whole.other.slice(tail.length);
  const rest = tail === '' ? afterTail : afterTail.replace(LEADING_SUFFIX, '');
  return { tail, rest };
};

const frontTail = (front: ParsedAddress): string =>
  [front.number ?? '', front.other.replace(TRAILING_SUFFIX, '')]
    .filter((part) => part !== '')
    .join('-');

/**
 * 前半の結果が、全体の結果と同じ住所を指すかを判定する
 *
 * 都道府県・市区町村・町字と住所の末尾を比べる。前半の住所の末尾は number と、
 * 末尾の号・番地・番・地を落とした other を - でつないだもの。
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
): boolean =>
  front.prefecture === whole.prefecture &&
  front.city === whole.city &&
  front.town === whole.town &&
  frontTail(front) === tail;

/**
 * 切れ目より後ろのテキストから建物部を取り出す
 *
 * 前後の空白と、先頭のハイフン（続いていればすべて）を落とす。
 *
 * @param text - 切れ目より後ろのテキスト
 * @returns 建物部。空なら建物部は無い
 */
export const toBuilding = (text: string): string =>
  text.trim().replace(LEADING_HYPHENS, '').trim();

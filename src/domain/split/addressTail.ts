/**
 * addressTail.ts
 *
 * @description 全体の住所の末尾と残り（切れ目の判定の文脈）、前半の住所の末尾、番号の上限
 */

import type { ParsedAddress } from '../../ports/addressParser.ts';
import {
  ADDRESS_NUMBER_LIMIT,
  ASCII_DIGITS,
  BLOCK_SEPARATOR,
  DIGIT_RUNS,
  FLOOR_OR_ROOM_MARK,
  KANJI_DIGIT_VALUES,
  KANJI_UNIT_VALUES,
  LOT_JOINER,
  ORIGINAL_NUMBER_CHARS,
  SPACED_FLOOR,
  LEADING_SUFFIX,
  LEADING_TAIL_NUMBER,
  NON_DIGITS,
  THIRD_NUMBER_MAX_DIGITS,
  TRAILING_SUFFIX,
} from './rules.ts';

// sticky の正規表現は lastIndex を書き換えて使うので、共有せずこのファイルの中に置く
const ORIGINAL_NUMBER = new RegExp(
  `(?<![${ORIGINAL_NUMBER_CHARS}])([${ORIGINAL_NUMBER_CHARS}]+)`,
  'uy',
);
const ORIGINAL_JOINER_AT = new RegExp(
  `([^${ORIGINAL_NUMBER_CHARS}\\s]{1,4})`,
  'uy',
);
const ORIGINAL_NUMBER_START = new RegExp(
  `(?<![${ORIGINAL_NUMBER_CHARS}])[${ORIGINAL_NUMBER_CHARS}]`,
  'gu',
);

const leadingTailNumber = (text: string): string =>
  LEADING_TAIL_NUMBER.exec(text)?.[0] ?? '';

const digitRuns = (numberPart: string): RegExpExecArray[] => [
  ...numberPart.matchAll(DIGIT_RUNS),
];

const hyphenate = (numberPart: string): string =>
  numberPart.replace(NON_DIGITS, '-');

/** 住所の末尾と、その後ろに残ったテキスト */
export interface AddressTail {
  readonly tail: string;
  readonly rest: string;
}

// ブロック地番（準則67条1項(8)）の街区の番号は、本番-支号の数に入れない
const blockNumberCount = (
  numberPart: string,
  runs: readonly RegExpExecArray[],
): number => {
  let blocks = 0;
  for (const [i, run] of runs.entries()) {
    const next = runs[i + 1];
    if (next === undefined) {
      break;
    }
    const separator = numberPart.slice(run.index + run[0].length, next.index);
    if (BLOCK_SEPARATOR.test(separator)) {
      blocks = i + 1;
    }
  }
  return blocks;
};

/**
 * level 3 の番号の並びのうち、住所の番号として取る部分を返す（docs/design.md の手順5）
 *
 * @param numberPart - unmatched の先頭の番号の並び
 * @param after - unmatched のうち numberPart より後ろ
 * @param thirdIsLot - 3つ目の番号が元のテキストで「の」などでつながる（筆として住所に残す）なら true
 * @param floorDigits - 最後の番号の末尾のうち、元のテキストで空白のあとにある階の数字の桁数（無ければ 0）
 * @returns numberPart の先頭から、住所の番号として取る部分
 */
export const addressNumbers = (
  numberPart: string,
  after: string,
  thirdIsLot: boolean,
  floorDigits: number,
): string => {
  const runs = digitRuns(numberPart);
  let count = runs.length;
  if (count > 1 && FLOOR_OR_ROOM_MARK.test(after)) {
    const last = runs[count - 1];
    if (last !== undefined && floorDigits > 0 && last[0].length > floorDigits) {
      return addressNumbers(
        numberPart.slice(0, last.index + last[0].length - floorDigits),
        '',
        thirdIsLot,
        0,
      );
    }
    count--;
  }
  const blocks = blockNumberCount(numberPart, runs);
  const third = runs[blocks + ADDRESS_NUMBER_LIMIT]?.[0] ?? '';
  const keepsThird =
    third !== '' && (thirdIsLot || third.length <= THIRD_NUMBER_MAX_DIGITS);
  count = Math.min(count, blocks + ADDRESS_NUMBER_LIMIT + (keepsThird ? 1 : 0));
  const last = runs[count - 1];
  return last === undefined
    ? ''
    : numberPart.slice(0, last.index + last[0].length);
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

/**
 * level 3 の前半が、住所の番号として取れる数より多い番号を読んでいるかを判定する（docs/design.md の手順4の受け入れ条件）
 *
 * @param front - 建物部の始まりの位置までの前半の解析の結果
 * @param after - 建物部の始まりの位置から後ろのテキスト
 * @param thirdIsLot - 3つ目の番号が元のテキストで「の」などでつながるなら true
 * @returns 前半の番号の並びの後ろが、番号の数の上限か階・部屋の印で外れるなら true。level 8 の前半は false
 */
export const exceedsNumberLimit = (
  front: ParsedAddress,
  after: string,
  thirdIsLot: boolean,
): boolean => {
  if (front.level === 8) {
    return false;
  }
  const numberPart = leadingTailNumber(front.unmatched);
  const remaining = front.unmatched.slice(numberPart.length);
  return (
    addressNumbers(
      numberPart,
      remaining === '' ? after : remaining,
      thirdIsLot,
      0,
    ) !== numberPart
  );
};

const kanjiNumber = (text: string): number => {
  let total = 0;
  let digit = 0;
  let positional = 0;
  for (const char of text) {
    const value = KANJI_DIGIT_VALUES.indexOf(char);
    const unit = KANJI_UNIT_VALUES[char];
    if (unit !== undefined) {
      total += (digit === 0 ? 1 : digit) * unit;
      digit = 0;
      positional = -1;
    } else {
      digit = value >= 0 ? value : Number(char);
      positional = positional < 0 ? positional : positional * 10 + digit;
    }
  }
  return positional >= 0 ? positional : total + digit;
};

const numberValue = (text: string): number =>
  ASCII_DIGITS.test(text) ? Number(text) : kanjiNumber(text);

const joinersAt = (
  text: string,
  start: number,
  values: readonly number[],
): string[] | undefined => {
  const joiners: string[] = [];
  let position = start;
  for (const [i, value] of values.entries()) {
    if (i > 0) {
      ORIGINAL_JOINER_AT.lastIndex = position;
      const joiner = ORIGINAL_JOINER_AT.exec(text)?.[1];
      if (joiner === undefined) {
        return undefined;
      }
      joiners.push(joiner);
      position += joiner.length;
    }
    ORIGINAL_NUMBER.lastIndex = position;
    const number = ORIGINAL_NUMBER.exec(text)?.[1];
    if (number === undefined || numberValue(number) !== value) {
      return undefined;
    }
    position += number.length;
  }
  return joiners;
};

/**
 * 番号の並びの3つ目が、元のテキストで「の」などでつながっているかを判定する（docs/design.md の手順5）
 *
 * 元のテキストの番号は、算用数字でも漢数字でも同じ値として読む。
 *
 * @param text - ガード付き NFKC をかけたテキスト
 * @param numberPart - unmatched の先頭の番号の並び
 * @param runs - numberPart の中の数字の並び（DIGIT_RUNS の一致）
 * @returns 元のテキストで同じ番号が並ぶ最初の箇所（町字に最も近い箇所）の、3つ目の番号の前のつなぎが「の」「ノ」で終わるなら true
 */
export const isThirdLot = (
  text: string,
  numberPart: string,
  runs: readonly RegExpExecArray[],
): boolean => {
  const third = blockNumberCount(numberPart, runs) + ADDRESS_NUMBER_LIMIT;
  if (runs.length <= third) {
    return false;
  }
  const values = runs.slice(0, third + 1).map((run) => Number(run[0]));
  for (const start of text.matchAll(ORIGINAL_NUMBER_START)) {
    const joiners = joinersAt(text, start.index, values);
    if (joiners !== undefined) {
      return LOT_JOINER.test(joiners[third - 1] ?? '');
    }
  }
  return false;
};

/**
 * 最後の番号の末尾のうち、元のテキストで空白のあとにある階の数字の桁数を返す（docs/design.md の手順5）
 *
 * NJA は other の空白を消すので、`N番地M 3F` の `M` と `3` は other では1つの番号になる。
 *
 * @param text - ガード付き NFKC をかけたテキスト
 * @param last - unmatched の先頭の番号の並びの、最後の番号（無ければ ''）
 * @returns 元のテキストで、最後の番号が空白をはさんで階の数字に続くなら、その階の数字の桁数。無ければ 0
 */
export const spacedFloorDigits = (text: string, last: string): number => {
  for (const match of text.matchAll(SPACED_FLOOR)) {
    const [, number = '', floor = ''] = match;
    if (number + floor === last) {
      return floor.length;
    }
  }
  return 0;
};

/** 全体の結果と、そこから1回だけ導く住所の末尾と残り */
export interface WholeContext extends AddressTail {
  readonly whole: ParsedAddress;
  /** 3つ目の番号が元のテキストで「の」などでつながる（筆として住所に残す） */
  readonly thirdIsLot: boolean;
}

/**
 * 全体の結果から、切れ目の判定に使う文脈を作る
 *
 * @param whole - テキスト全体の解析の結果（level 3 以上）
 * @param text - ガード付き NFKC をかけたテキスト
 * @returns 全体の結果と、その住所の末尾と残り
 */
export const wholeContext = (
  whole: ParsedAddress,
  text: string,
): WholeContext => {
  if (whole.level === 8) {
    const tail = whole.block ?? '';
    const rest =
      tail === ''
        ? whole.unmatched
        : whole.unmatched.replace(LEADING_SUFFIX, '');
    return { whole, tail, rest, thirdIsLot: false };
  }
  const numberPart = leadingTailNumber(whole.unmatched);
  const runs = digitRuns(numberPart);
  const thirdIsLot = isThirdLot(text, numberPart, runs);
  const kept = addressNumbers(
    numberPart,
    whole.unmatched.slice(numberPart.length),
    thirdIsLot,
    spacedFloorDigits(text, runs.at(-1)?.[0] ?? ''),
  );
  const tail = hyphenate(kept);
  const afterTail = whole.unmatched.slice(kept.length);
  const rest = tail === '' ? afterTail : afterTail.replace(LEADING_SUFFIX, '');
  return { whole, tail, rest, thirdIsLot };
};

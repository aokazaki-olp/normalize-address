/**
 * rules.ts
 *
 * @description 住所部と建物部の切れ目の判定に使う規則のデータと、それから組み立てた正規表現
 */

// 先頭・末尾の replace で最長の接尾語を落とすため、前方が同じものは長いものを先に置く
const ADDRESS_SUFFIXES = [
  '号',
  '番地先',
  '番先',
  '番地',
  '番',
  '地先',
  '地',
] as const;
const NUMBER_SEPARATORS = [
  '-',
  '番地の',
  '番地',
  '番の',
  '番-',
  '番',
  '号',
  'の',
  'ノ',
  '街区',
  '区',
] as const;
// 号の直後の数字は階・部屋の番号のことが多いため、住所の末尾の区切りには号を入れない
const TAIL_SEPARATORS = NUMBER_SEPARATORS.filter(
  (separator) => separator !== '号',
);
const ROOM_SUFFIXES = ['号室', '室'] as const;
// NJA 3.1.3 の正規表現が対象にする漢数字（docs/nja-3.1.3-char-rules.md）
const KANJI_NUMERALS = '〇一二三四五六七八九十百千';
// NJA 3.1.3 が横棒として扱う字（normalize-core の HORIZONTAL_BAR と同じ集合。normalize-core が公開していないため写す）
const HORIZONTAL_BARS = String.raw`-\uff0d\ufe63\u2212\u2010\u2043\u2011\u2012\u2013\u2014\ufe58\u2015\u23af\u23e4\u30fc\uff70\u2500\u2501`;
const CUT_AFTER_ANY = '号地';
const CUT_AFTER_NUMBER_END = '番目';
const NUMBER_CONTINUATION = '号番地';

const DIGIT = '[0-9]';
const DIGITS = '[0-9]+';
const group = (items: readonly string[]): string => `(?:${items.join('|')})`;
const SUFFIX = group(ADDRESS_SUFFIXES);
const ROOM_SUFFIX = group(ROOM_SUFFIXES);
const F_NOT_WORD = '(?![A-Za-z])';
const F_CLEAR_END = String.raw`(?=$|[\s0-9・、,(])`;

export const BEFORE_ANY = new RegExp(`^[${CUT_AFTER_ANY}]$`, 'u');
export const BEFORE_NON_NUMBER = new RegExp(
  `^[0-9${KANJI_NUMERALS}${CUT_AFTER_NUMBER_END}]$`,
  'u',
);
export const NUMBER_PART = new RegExp(`^[0-9${NUMBER_CONTINUATION}]$`, 'u');
export const LEADING_TAIL_NUMBER = new RegExp(
  `^${DIGITS}(?:${group(TAIL_SEPARATORS)}${DIGITS})*`,
  'u',
);
export const NON_DIGITS = /[^0-9]+/gu;
export const LEADING_SUFFIX = new RegExp(`^${SUFFIX}`, 'u');
export const TRAILING_SUFFIX = new RegExp(`${SUFFIX}$`, 'u');
export const LEADING_BARS = new RegExp(`^[${HORIZONTAL_BARS}]+`, 'u');
export const FIRST_ASCII_DIGIT = new RegExp(DIGIT, 'u');
export const FRONT_UNMATCHED = new RegExp(
  `^${DIGITS}(?:${group(NUMBER_SEPARATORS)}${DIGITS})*${SUFFIX}?$`,
  'u',
);
export const ENDS_AS_ADDRESS = new RegExp(
  `${group([DIGIT, ...ADDRESS_SUFFIXES])}$`,
  'u',
);
export const CONTINUES_ADDRESS = new RegExp(
  `^(?:${group([...ADDRESS_SUFFIXES, '[のノ]'])}(?=${DIGIT})|線)`,
  'u',
);
export const FLOOR_AFTER_BAR = new RegExp(
  `^${DIGITS}(?:階|F${F_NOT_WORD})`,
  'u',
);
export const FLOOR_AFTER_SPACE = new RegExp(
  `^${DIGITS}(?:階|F${F_CLEAR_END})`,
  'u',
);
export const ROOM = new RegExp(`^${DIGITS}${ROOM_SUFFIX}`, 'u');
export const LEADING_DIGIT = new RegExp(`^${DIGIT}`, 'u');
export const SUFFIX_ONLY = new RegExp(`^${SUFFIX}$`, 'u');
export const LEADING_SPACE = /^\s/u;
export const LEADING_DIGITS = new RegExp(`^${DIGITS}`, 'u');
export const LEADING_KANJI_NUMERAL = new RegExp(`^[${KANJI_NUMERALS}]`, 'u');
export const ROOM_AFTER_NUMBERS = new RegExp(
  `(?<![0-9-])${DIGITS}(?:-${DIGITS}){2,}(-)${DIGITS}${ROOM_SUFFIX}`,
  'du',
);

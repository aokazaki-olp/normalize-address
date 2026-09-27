/**
 * split.ts
 *
 * @description 住所部と建物部の切れ目の候補・建物部の始まりの位置と、解析の結果の比較
 */

import type { ParsedAddress } from '../ports/addressParser.ts';
import type { SplitStatus } from '../ports/addressResult.ts';
import { basicNormalize, normalizeBasicNormalized } from './abrgNormalize.ts';
import { trackText, type TrackedText } from './trackedText.ts';

// 漢数字は NJA 3.1.3 の正規表現が対象にする字（docs/nja-3.1.3-char-rules.md）
const BEFORE_ANY = /^[号地]$/u;
const BEFORE_NON_NUMBER = /^[0-9〇一二三四五六七八九十百千番目]$/u;
const NUMBER_PART = /^[0-9号番地]$/u;
const LEADING_NUMBER = /^[0-9]+(?:-[0-9]+)*/u;
const LEADING_SUFFIX = /^(?:号|番地|番|地)/u;
const TRAILING_SUFFIX = /(?:号|番地|番|地)$/u;
const LEADING_HYPHENS = /^-+/u;
const FIRST_ASCII_DIGIT = /[0-9]/u;
const FRONT_OTHER =
  /^[0-9]+(?:(?:-|番地の|番地|番の|番-|番|号|の|ノ|街区)[0-9]+)*(?:号|番地|番|地)?$/u;
const ENDS_AS_ADDRESS = /(?:[0-9]|号|番地|番|地)$/u;
const CONTINUES_ADDRESS = /^(?:(?:番地|番|号|地|[のノ]|[ー-])(?=[0-9])|線)/u;
const LEADING_SPACE = /^\s/u;
const LEADING_DIGITS = /^[0-9]+/u;
const LEADING_KANJI_NUMERAL = /^[〇一二三四五六七八九十百千]/u;
const ROOM_AFTER_NUMBERS =
  /(?<![0-9-])[0-9]+(?:-[0-9]+){2,}(-)[0-9]+(?:号室|室)/du;

/** 切れ目の探索の結果 */
export interface SplitOutcome {
  split: SplitStatus;
  /** 住所の項目・level・point を取る解析の結果 */
  address: ParsedAddress;
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
  const tail =
    whole.level === 8
      ? (whole.number ?? '')
      : (LEADING_NUMBER.exec(whole.other)?.[0] ?? '');
  const afterTail =
    whole.level === 8 ? whole.other : whole.other.slice(tail.length);
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
): boolean => isSameArea(whole, front) && frontTail(front) === tail;

const isSameArea = (whole: ParsedAddress, front: ParsedAddress): boolean =>
  front.prefecture === whole.prefecture &&
  front.city === whole.city &&
  front.town === whole.town;

const readsThrough = (whole: ParsedAddress, front: ParsedAddress): boolean => {
  const other = front.other.trim();
  if (wholeTail(whole).tail !== '') {
    return front.level === 8
      ? other === ''
      : other === '' || FRONT_OTHER.test(other);
  }
  return whole.other.trim().startsWith(other) && ENDS_AS_ADDRESS.test(other);
};

const continuesWholeNumber = (
  whole: ParsedAddress,
  front: ParsedAddress,
  building: string,
): boolean => {
  const digits = LEADING_DIGITS.exec(building)?.[0];
  return (
    digits !== undefined &&
    wholeTail(whole).tail === `${frontTail(front)}-${digits}`
  );
};

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
 * 始まらない。全体が level 8 で前半が level 8 未満なら、建物部が漢数字で始まるか、
 * 後半が空白で始まり建物部の先頭の数字が全体の番地の続きでない。
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
    keepsWholeNumber(whole, front, after, building)
  );
};

const separatorOrigins = (text: string, prepared: TrackedText): Set<number> => {
  const kept = new Map<number, string>();
  for (const [i, origin] of prepared.origins.entries()) {
    kept.set(origin, prepared.text.charAt(i));
  }
  const separators = new Set<number>();
  for (let i = 0; i < text.length; i++) {
    const char = kept.get(i);
    if (char === undefined || char === ' ' || char === '-') {
      separators.add(i);
    }
  }
  return separators;
};

const toTextStart = (
  text: string,
  prepared: TrackedText,
  formatted: TrackedText,
  space: number,
): number | undefined => {
  const before = formatted.origins.slice(0, space).filter((o) => o >= 0);
  const after = formatted.origins.slice(space + 1).filter((o) => o >= 0);
  if (after.length === 0) {
    return undefined;
  }
  const end = Math.max(-1, ...before) + 1;
  let start = Math.min(...after);
  if (start < end) {
    return undefined;
  }
  const separators = separatorOrigins(text, prepared);
  while (start > end && separators.has(start - 1)) {
    start--;
  }
  return start;
};

const abrgStart = (text: string, prepared: TrackedText): number | undefined => {
  const formatted = normalizeBasicNormalized(prepared).text;
  const digit = formatted.text.search(FIRST_ASCII_DIGIT);
  if (digit < 0) {
    return undefined;
  }
  const space = formatted.text.indexOf(' ', digit);
  if (space < 0) {
    return undefined;
  }
  return toTextStart(text, prepared, formatted, space);
};

const roomStart = (prepared: TrackedText): number | undefined => {
  const hyphen = ROOM_AFTER_NUMBERS.exec(prepared.text)?.indices?.[1];
  if (hyphen === undefined) {
    return undefined;
  }
  const origin = prepared.origins[hyphen[0]] ?? -1;
  return origin < 0 ? undefined : origin;
};

/**
 * 建物部の始まりの位置の候補を返す
 *
 * abr-geocoder の規則で整えた文字列で、最初の算用数字より後ろにある最初の空白の後ろを建物部とし、
 * 元のテキストの位置に対応づける。次に、ハイフンでつないだ3つ以上の番号の後ろに -N号室・-N室 が続くとき、
 * そのハイフンの位置を候補にする。
 *
 * @param text - ガード付き NFKC をかけたテキスト
 * @returns 候補の位置（UTF-16 のインデックス、重複なし、先頭と末尾を除く）
 */
export const buildingStarts = (text: string): number[] => {
  const prepared = basicNormalize(trackText(text));
  const starts: number[] = [];
  for (const start of [abrgStart(text, prepared), roomStart(prepared)]) {
    if (
      start !== undefined &&
      start > 0 &&
      start < text.length &&
      !starts.includes(start)
    ) {
      starts.push(start);
    }
  }
  return starts;
};

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

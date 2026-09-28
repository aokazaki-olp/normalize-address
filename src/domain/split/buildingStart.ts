/**
 * buildingStart.ts
 *
 * @description 建物部の始まりの位置の候補と、元のテキストの位置への対応づけ
 */

import { basicNormalize, normalizeBasicNormalized } from '../abrgNormalize.ts';
import { trackText, type TrackedText } from '../trackedText.ts';
import { FIRST_ASCII_DIGIT, ROOM_AFTER_NUMBERS } from './rules.ts';

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

/**
 * normalizeAddress.ts
 *
 * @description 住所の正規化の処理の流れ（AddressParser を通して解析する）
 */

import { guardedNfkc } from '@arihirookazaki/normalize-core';
import { buildResult } from '../domain/buildResult.ts';
import {
  isSameAddress,
  splitCandidates,
  wholeTail,
  type SplitOutcome,
} from '../domain/split.ts';
import type { AddressParser, ParsedAddress } from '../ports/addressParser.ts';
import type {
  AddressResult,
  NormalizeAddressOptions,
} from '../ports/addressResult.ts';

export type NormalizeAddress = (
  input: string,
  options?: NormalizeAddressOptions,
) => Promise<AddressResult>;

const findSplit = async (
  parser: AddressParser,
  text: string,
  whole: ParsedAddress,
): Promise<SplitOutcome> => {
  if (whole.level < 3) {
    return { split: 'skipped', other: whole.other, building: '' };
  }
  const { tail, rest } = wholeTail(whole);
  if (rest === '') {
    return { split: 'none', other: whole.other, building: '' };
  }
  for (const position of splitCandidates(text)) {
    const front = await parser.parse(text.slice(0, position));
    if (isSameAddress(whole, tail, front)) {
      return {
        split: 'found',
        other: front.other,
        building: text.slice(position).trim(),
      };
    }
  }
  return { split: 'unresolved', other: whole.other, building: '' };
};

/**
 * AddressParser を使う normalizeAddress を作る
 *
 * @param parser - 住所を解析する依存
 * @returns 住所を正規化する関数
 */
export const createNormalizeAddress =
  (parser: AddressParser): NormalizeAddress =>
  async (input, options) => {
    if (typeof input !== 'string') {
      throw new TypeError('input には string を指定してください');
    }
    const text = guardedNfkc(input);
    const whole = await parser.parse(text);
    const outcome = await findSplit(parser, text, whole);
    return buildResult(input, whole, outcome, options);
  };

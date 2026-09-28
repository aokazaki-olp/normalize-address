/**
 * addressNormalizer.ts
 *
 * @description 住所の正規化器の処理の流れ（AddressParser を通して解析する）
 */

import { guardedNfkc } from '@arihirookazaki/normalize-core';
import { buildResult } from '../domain/buildResult.ts';
import { prepareOptions } from '../domain/options.ts';
import { isAddressFront, isSameAddress } from '../domain/split/acceptance.ts';
import {
  wholeContext,
  type WholeContext,
} from '../domain/split/addressTail.ts';
import { toBuilding } from '../domain/split/building.ts';
import { buildingStarts } from '../domain/split/buildingStart.ts';
import { splitCandidates } from '../domain/split/candidates.ts';
import {
  foundAtBuildingStart,
  foundAtCandidate,
  unsplit,
  type FoundOutcome,
  type SplitOutcome,
} from '../domain/split/outcome.ts';
import type { AddressParser, ParsedAddress } from '../ports/addressParser.ts';
import type {
  AddressNormalizer,
  AddressNormalizerOptions,
} from '../ports/addressResult.ts';

const findAtBuildingStart = async (
  parser: AddressParser,
  text: string,
  context: WholeContext,
): Promise<FoundOutcome | undefined> => {
  for (const start of buildingStarts(text)) {
    const after = text.slice(start);
    const building = toBuilding(after);
    if (building === '') {
      continue;
    }
    const front = await parser.parse(text.slice(0, start));
    if (isAddressFront(context, front, { after, building })) {
      return foundAtBuildingStart(front, building);
    }
  }
  return undefined;
};

const findAtCandidate = async (
  parser: AddressParser,
  text: string,
  context: WholeContext,
): Promise<SplitOutcome | undefined> => {
  for (const position of splitCandidates(text)) {
    const front = await parser.parse(text.slice(0, position));
    if (isSameAddress(context, front)) {
      const building = toBuilding(text.slice(position));
      return building === ''
        ? unsplit(context.whole, 'none')
        : foundAtCandidate(context.whole, front, building);
    }
  }
  return undefined;
};

const findSplit = async (
  parser: AddressParser,
  text: string,
  whole: ParsedAddress,
): Promise<SplitOutcome> => {
  if (whole.level < 3) {
    return unsplit(whole, 'skipped');
  }
  const context = wholeContext(whole);
  const atBuildingStart = await findAtBuildingStart(parser, text, context);
  if (atBuildingStart !== undefined) {
    return atBuildingStart;
  }
  if (context.rest === '') {
    return unsplit(whole, 'none');
  }
  const atCandidate = await findAtCandidate(parser, text, context);
  return atCandidate ?? unsplit(whole, 'unresolved');
};

/**
 * AddressParser を使う住所の正規化器を作る
 *
 * options はここで1回だけ検査し、字形の指定をマージしておく。
 *
 * @param parser - 住所を解析する依存
 * @param options - 字形の指定と、結果に足す項目
 * @returns 住所の正規化器
 * @throws {TypeError} options が検査を満たさない場合
 */
export const createAddressNormalizer = (
  parser: AddressParser,
  options?: AddressNormalizerOptions,
): AddressNormalizer => {
  const prepared = prepareOptions(options);
  return {
    normalize: async (input) => {
      if (typeof input !== 'string') {
        throw new TypeError('input には string を指定してください');
      }
      const text = guardedNfkc(input);
      const whole = await parser.parse(text);
      const outcome = await findSplit(parser, text, whole);
      return buildResult(input, whole, outcome, prepared);
    },
  };
};

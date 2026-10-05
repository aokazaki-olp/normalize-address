/**
 * index.ts
 *
 * @description 住所の正規化器の公開面
 */

import { createNjaParser } from './adapters/njaParser.ts';
import { createAddressNormalizer } from './application/addressNormalizer.ts';
import type {
  AddressNormalizer as Normalizer,
  AddressNormalizerFactory,
} from './ports/addressNormalizer.ts';
import type { AddressNormalizerOptions } from './ports/addressResult.ts';

const njaParser = createNjaParser();

const create = (options?: AddressNormalizerOptions): Normalizer =>
  createAddressNormalizer(njaParser, options);

/** 住所の正規化器（normalize で住所を正規化する） */
export type AddressNormalizer = Normalizer;

/** 住所の正規化器を作る（AddressNormalizer.create） */
export const AddressNormalizer: AddressNormalizerFactory = { create };

export { AddressNormalizationError } from './adapters/addressNormalizationError.ts';
export type {
  AddressLevel,
  AddressNormalizerOptions,
  AddressPoint,
  AddressResult,
  AddressStyle,
} from './ports/addressResult.ts';
export type {
  CharStyle,
  CharTarget,
  WidthMode,
} from '@arihirookazaki/normalize-core';

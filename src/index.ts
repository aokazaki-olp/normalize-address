/**
 * index.ts
 *
 * @description 住所の正規化器の公開面
 */

import { createNjaParser } from './adapters/njaParser.ts';
import { createAddressNormalizer } from './application/addressNormalizer.ts';
import type { AddressNormalizer as Normalizer } from './ports/addressNormalizer.ts';
import type { AddressNormalizerOptions } from './ports/addressResult.ts';

const njaParser = createNjaParser();

/**
 * 日本の住所の正規化器を作る
 *
 * 住所の解析は NJA（`@geolonia/normalize-japanese-addresses`）に任せ、建物部は入力から取り直す。
 * options はここで1回だけ検査し、字形の指定をマージしておく。あとで options を書き換えても正規化器には効かない。
 *
 * NJA の設定、取得処理の差し替え、住所データのキャッシュはプロセスに1つで、create を何回呼んでも
 * すべての正規化器で共有される。最初の解析の前に NJA の取得処理を差し替えるので、同じプロセスで NJA を直接使うコードの挙動も変わる。
 *
 * @param options - 字形の指定と、結果に足す項目
 * @returns 住所の正規化器
 * @throws {TypeError} options が object でない場合、nja・codes が boolean でない場合、または字形の指定が検査を満たさない場合
 */
const create = (options?: AddressNormalizerOptions): Normalizer =>
  createAddressNormalizer(njaParser, options);

/** 住所の正規化器（normalize で住所を正規化する） */
export type AddressNormalizer = Normalizer;

export const AddressNormalizer = { create };

export { NormalizeAddressError } from './adapters/normalizeAddressError.ts';
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

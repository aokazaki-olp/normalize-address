/**
 * index.ts
 *
 * @description 住所の正規化器の公開面
 */

import { createNjaParser } from './adapters/njaParser.ts';
import { createNormalizeAddress } from './application/normalizeAddress.ts';
import type {
  AddressResult,
  NormalizeAddressOptions,
} from './ports/addressResult.ts';

/**
 * 日本の住所を正規化する
 *
 * 住所の解析は NJA（`@geolonia/normalize-japanese-addresses`）に任せ、建物部は入力から取り直す。
 * NJA はプロセス内で住所データをキャッシュする。最初の呼び出しの前に NJA の取得処理を差し替えるので、
 * 同じプロセスで NJA を直接使うコードの挙動も変わる。
 *
 * @param input - 住所の文字列
 * @param options - 字形の指定と、結果に足す項目
 * @returns 正規化の結果
 * @throws {TypeError} input が文字列でない場合、または字形の指定が検査を満たさない場合
 * @throws {AddressDataError} 住所データの取得に失敗した場合
 */
export const normalizeAddress: (
  input: string,
  options?: NormalizeAddressOptions,
) => Promise<AddressResult> = createNormalizeAddress(createNjaParser());

export { AddressDataError } from './adapters/addressDataError.ts';
export type {
  AddressResult,
  AddressStyle,
  NormalizeAddressOptions,
} from './ports/addressResult.ts';
export type {
  CharStyle,
  CharTarget,
  WidthMode,
} from '@arihirookazaki/normalize-core';

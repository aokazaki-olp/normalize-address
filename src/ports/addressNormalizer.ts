/**
 * addressNormalizer.ts
 *
 * @description 住所の正規化器（AddressNormalizer）の契約
 */

import type { AddressResult } from './addressResult.ts';

/** 住所の正規化器 */
export interface AddressNormalizer {
  /**
   * 日本の住所を正規化する
   *
   * @param input - 住所の文字列
   * @returns 正規化の結果
   * @throws {TypeError} input が文字列でない場合
   * @throws {NormalizeAddressError} 入力の誤り以外で処理を終えられなかった場合（住所データの取得の失敗、NJA が想定外の level を返した）。
   *   その入力をあとで再試行する価値がある（NJA の想定外の level を除く）。判定は `error.name === 'NormalizeAddressError'` で行える
   */
  normalize(input: string): Promise<AddressResult>;
}

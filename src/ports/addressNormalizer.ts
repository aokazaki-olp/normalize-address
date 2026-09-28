/**
 * addressNormalizer.ts
 *
 * @description 住所の正規化器（AddressNormalizer）と、それを作るもの（AddressNormalizerFactory）の契約
 */

import type {
  AddressNormalizerOptions,
  AddressResult,
} from './addressResult.ts';

/** 住所の正規化器 */
export interface AddressNormalizer {
  /**
   * 日本の住所を正規化する
   *
   * @param input - 住所の文字列
   * @returns 正規化の結果
   * @throws {TypeError} input が文字列でない場合
   * @throws {NormalizeAddressError} 入力の誤り以外で処理を終えられなかった場合（住所データの取得の失敗、NJA の処理の失敗）。
   *   原因は cause を見る。取得の失敗なら、その入力をあとで再試行する価値がある。判定は `error.name === 'NormalizeAddressError'` で行える
   */
  normalize(input: string): Promise<AddressResult>;
}

/** 住所の正規化器を作るもの */
export interface AddressNormalizerFactory {
  /**
   * 日本の住所の正規化器を作る
   *
   * 住所の解析は NJA（`@geolonia/normalize-japanese-addresses`）に任せ、建物部は、入力にガード付き NFKC をかけたテキストから切り出す。
   * options はここで1回だけ検査し、字形の指定をマージしておく。あとで options を書き換えても正規化器には効かない。
   *
   * NJA の設定、取得処理の差し替え、住所データのキャッシュはモジュールの読み込み単位に1つ（worker_threads の worker ごとに別）で、
   * create を何回呼んでもすべての正規化器で共有される。最初の解析の前に NJA の取得処理を差し替えるので、
   * 同じ読み込み単位で NJA を直接使うコードの挙動も変わる。
   *
   * @param options - 字形の指定と、結果に足す項目
   * @returns 住所の正規化器
   * @throws {TypeError} options が object でない場合、nja・codes が boolean でない場合、または字形の指定が検査を満たさない場合
   */
  create(options?: AddressNormalizerOptions): AddressNormalizer;
}

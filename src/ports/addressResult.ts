/**
 * addressResult.ts
 *
 * @description 住所の正規化器（AddressNormalizer）の契約と、そのオプションと結果の型
 */

import type { CharStyle } from '@arihirookazaki/normalize-core';
import type { AddressLevel, AddressPoint } from './addressParser.ts';

/** 字形の指定を当てる項目 */
export type StyledField =
  'prefecture' | 'city' | 'town' | 'block' | 'building' | 'unmatched';

/** 出力の字形の指定 */
export interface AddressStyle {
  /** すべての項目に共通の指定 */
  default?: CharStyle;
  /** 項目ごとの上書き。false なら字形の指定を当てない */
  fields?: Partial<Record<StyledField, CharStyle | false>>;
}

/** AddressNormalizer.create のオプション */
export interface AddressNormalizerOptions {
  /** 字形の指定 */
  style?: AddressStyle;
  /** true なら NJA の結果を result.nja に入れる */
  nja?: boolean;
  /** true なら result.codes を入れる */
  codes?: boolean;
}

/** 住所と建物部の切れ目の探索の結果 */
export type SplitStatus = 'found' | 'none' | 'unresolved' | 'skipped';

/** AddressNormalizer.normalize の結果 */
export interface AddressResult {
  /** 渡された文字列そのまま */
  input: string;
  /** 都道府県（NJA の pref） */
  prefecture?: string;
  /** 郡＋市区町村＋政令市の区（NJA の city） */
  city?: string;
  /** 町字：大字・丁目・小字（NJA の town） */
  town?: string;
  /**
   * 番地等（NJA の addr）。住居表示の地域では「街区符号-住居番号」（例 21-3）、地番の地域では地番（例 3060-1）。
   * 地番の地域では、道路で囲まれた街区ではなく一筆の土地を指す
   */
  block?: string;
  /** 建物部。無ければ '' */
  building: string;
  /**
   * データで確かめられなかった住所の残り（NJA の other にあたる）。ただし建物部は building に切り出してある。
   * split が 'unresolved' のときは、建物部を含む残り全部
   */
  unmatched: string;
  /** NJA の level */
  level: AddressLevel;
  /** 位置情報 */
  point?: AddressPoint;
  /** 切れ目の探索の結果 */
  split: SplitStatus;
  /** 全国地方公共団体コード（6桁）と町字 ID（7桁）。codes オプションが true のときだけ入る */
  codes?: { lgCode?: string; machiazaId?: string };
  /** NJA の結果そのもの。nja オプションが true のときだけ入る */
  nja?: Readonly<Record<string, unknown>>;
}

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

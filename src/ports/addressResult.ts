/**
 * addressResult.ts
 *
 * @description 住所の正規化器（AddressNormalizer）のオプションと結果の型
 */

import type { CharStyle } from '@arihirookazaki/normalize-core';

/**
 * どこまで判別できたか（NJA 3.1.3 の level）。0：都道府県も判別できなかった、1：都道府県まで、2：市区町村まで、
 * 3：丁目・町字まで、8：住居表示住所または地番まで
 */
export type AddressLevel = 0 | 1 | 2 | 3 | 8;

/** 位置情報（NJA 3.1.3 の point。EPSG:4326（WGS84）） */
export interface AddressPoint {
  /** 緯度 */
  lat: number;
  /** 経度 */
  lng: number;
  /**
   * 位置の正確さ。1：都道府県の代表点、2：市区町村の代表点、3：丁目・町字の代表点、8：住居表示住所または地番の位置。
   * 結果の level と違うことがある
   */
  level: number;
}

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
  /** 都道府県（NJA の pref）。読めなければ null */
  prefecture: string | null;
  /** 郡＋市区町村＋政令市の区（NJA の city）。読めなければ null */
  city: string | null;
  /** 町字：大字・丁目・小字（NJA の town）。読めなければ null */
  town: string | null;
  /**
   * 番地等（NJA の addr）。住居表示の地域では「街区符号-住居番号」（例 21-3）、地番の地域では地番（例 3060-1）。
   * 地番の地域では、道路で囲まれた街区ではなく一筆の土地を指す。読めなければ null
   */
  block: string | null;
  /** 建物部。無ければ '' */
  building: string;
  /**
   * データで確かめられなかった住所の残り（NJA の other にあたる）。ただし建物部は building に切り出してある。
   * split が 'unresolved' のときは、建物部を含む残り全部
   */
  unmatched: string;
  /** NJA の level */
  level: AddressLevel;
  /** 位置情報。無ければ null */
  point: AddressPoint | null;
  /** 切れ目の探索の結果 */
  split: SplitStatus;
  /** 全国地方公共団体コード（6桁）と町字 ID（7桁）。無いものは null。codes オプションが true のときだけ入る */
  codes?: { lgCode: string | null; machiazaId: string | null };
  /** NJA の結果そのもの。nja オプションが true のときだけ入る */
  nja?: Readonly<Record<string, unknown>>;
}

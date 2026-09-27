/**
 * addressResult.ts
 *
 * @description normalizeAddress のオプションと結果の型
 */

import type { CharStyle } from '@arihirookazaki/normalize-core';
import type { AddressLevel, AddressPoint } from './addressParser.ts';

/** 字形の指定を当てる項目 */
export type StyledField =
  'prefecture' | 'city' | 'town' | 'number' | 'building' | 'other';

/** 出力の字形の指定 */
export interface AddressStyle {
  /** すべての項目に共通の指定 */
  default?: CharStyle;
  /** 項目ごとの上書き。false なら字形の指定を当てない */
  fields?: Partial<Record<StyledField, CharStyle | false>>;
}

/** normalizeAddress のオプション */
export interface NormalizeAddressOptions {
  /** 字形の指定 */
  style?: AddressStyle;
  /** true なら NJA の結果を result.nja に入れる */
  nja?: boolean;
  /** true なら result.codes を入れる */
  codes?: boolean;
}

/** 住所と建物部の切れ目の探索の結果 */
export type SplitStatus = 'found' | 'none' | 'unresolved' | 'skipped';

/** normalizeAddress の結果 */
export interface AddressResult {
  /** 渡された文字列そのまま */
  input: string;
  /** 都道府県（NJA の pref） */
  prefecture?: string;
  /** 郡＋市区町村＋政令市の区（NJA の city） */
  city?: string;
  /** 町字：大字・丁目・小字（NJA の town） */
  town?: string;
  /** 街区符号-住居番号、または地番（NJA の addr） */
  number?: string;
  /** 建物部。無ければ '' */
  building: string;
  /** 住所として読めなかった残り */
  other: string;
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

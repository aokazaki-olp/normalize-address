/**
 * addressParser.ts
 *
 * @description 住所を解析する依存（AddressParser）の契約
 */

import type { AddressLevel, AddressPoint } from './addressResult.ts';

/** 住所を1回解析した結果。読めなかった項目は null */
export interface ParsedAddress {
  prefecture: string | null;
  city: string | null;
  town: string | null;
  block: string | null;
  unmatched: string;
  level: AddressLevel;
  point: AddressPoint | null;
  /** 全国地方公共団体コード（6桁） */
  lgCode: string | null;
  /** 町字 ID（7桁） */
  machiazaId: string | null;
  /** 解析器が返した結果の写し */
  raw: Readonly<Record<string, unknown>>;
}

/** 住所の文字列を解析する */
export interface AddressParser {
  parse(text: string): Promise<ParsedAddress>;
}

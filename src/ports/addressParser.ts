/**
 * addressParser.ts
 *
 * @description 住所を解析する依存（AddressParser）の契約
 */

export type AddressLevel = 0 | 1 | 2 | 3 | 8;

/** 解析の結果の位置情報 */
export interface AddressPoint {
  lat: number;
  lng: number;
  level: number;
}

/** 住所を1回解析した結果 */
export interface ParsedAddress {
  prefecture?: string;
  city?: string;
  town?: string;
  block?: string;
  unmatched: string;
  level: AddressLevel;
  point?: AddressPoint;
  /** 全国地方公共団体コード（6桁） */
  lgCode?: string;
  /** 町字 ID（7桁） */
  machiazaId?: string;
  /** 解析器が返した結果そのもの */
  raw: Readonly<Record<string, unknown>>;
}

/** 住所の文字列を解析する */
export interface AddressParser {
  parse(text: string): Promise<ParsedAddress>;
}

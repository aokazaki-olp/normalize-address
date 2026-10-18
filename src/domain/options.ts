/**
 * options.ts
 *
 * @description AddressNormalizer のオプションの検査と準備
 */

import { CharStyle } from '@arihirookazaki/normalize-core';
import type {
  AddressNormalizerOptions,
  AddressStyle,
  StyledField,
} from '../ports/addressResult.ts';

const STYLED_FIELDS = [
  'prefecture',
  'city',
  'town',
  'block',
  'building',
  'unmatched',
] as const satisfies readonly StyledField[];
// StyledField に項目を足して STYLED_FIELDS に足し忘れたら typecheck で落とす
const _coversAllStyledFields: Exclude<
  StyledField,
  (typeof STYLED_FIELDS)[number]
> extends never
  ? true
  : false = true;

/** 検査とマージを済ませたオプション */
export interface PreparedOptions {
  /** 項目ごとに当てる字形の指定。undefined なら当てない（ガード付き NFKC だけ） */
  readonly styles: Readonly<Record<StyledField, CharStyle | undefined>>;
  readonly nja: boolean;
  readonly codes: boolean;
}

const isObject = (value: unknown): value is object =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toFlag = (name: string, value: unknown): boolean => {
  if (value !== undefined && typeof value !== 'boolean') {
    throw new TypeError(`${name} には boolean を指定してください`);
  }
  return value === true;
};

const toStyles = (
  style: AddressStyle | undefined,
): Readonly<Record<StyledField, CharStyle | undefined>> => {
  const resolve = CharStyle.prepareFields(STYLED_FIELDS, style);
  return {
    prefecture: resolve('prefecture'),
    city: resolve('city'),
    town: resolve('town'),
    block: resolve('block'),
    building: resolve('building'),
    unmatched: resolve('unmatched'),
  };
};

/**
 * オプションを検査し、項目ごとの字形の指定を default とマージしておく（docs/design.md の「公開 API」と「字形の指定」）
 *
 * @param options - AddressNormalizer.create のオプション
 * @returns 検査とマージを済ませたオプション
 * @throws {TypeError} options が object でない場合、nja・codes が boolean でない場合、または字形の指定が検査を満たさない場合
 */
export const prepareOptions = (
  options: AddressNormalizerOptions | undefined,
): PreparedOptions => {
  if (options !== undefined && !isObject(options)) {
    throw new TypeError('options には object を指定してください');
  }
  return {
    styles: toStyles(options?.style),
    nja: toFlag('nja', options?.nja),
    codes: toFlag('codes', options?.codes),
  };
};

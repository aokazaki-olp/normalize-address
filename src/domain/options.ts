/**
 * options.ts
 *
 * @description AddressNormalizer のオプションの検査と準備
 */

import {
  applyCharStyle,
  mergeCharStyle,
  type CharStyle,
} from '@arihirookazaki/normalize-core';
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

const checkFields = (fields: AddressStyle['fields']): void => {
  if (fields === undefined) {
    return;
  }
  if (!isObject(fields)) {
    throw new TypeError('style.fields には object を指定してください');
  }
  for (const key of Object.keys(fields)) {
    if (!STYLED_FIELDS.some((field) => field === key)) {
      throw new TypeError(
        `style.fields のキーには ${STYLED_FIELDS.join('・')} を指定してください: ${key}`,
      );
    }
  }
  for (const field of STYLED_FIELDS) {
    const value = fields[field];
    if (value !== undefined && value !== false && !isObject(value)) {
      throw new TypeError(
        `style.fields.${field} には object または false を指定してください`,
      );
    }
  }
};

const toStyles = (
  style: AddressStyle | undefined,
): Readonly<Record<StyledField, CharStyle | undefined>> => {
  if (style !== undefined && !isObject(style)) {
    throw new TypeError('style には object を指定してください');
  }
  const base = style?.default;
  if (base !== undefined && !isObject(base)) {
    throw new TypeError('style.default には object を指定してください');
  }
  const fields = style?.fields;
  checkFields(fields);
  const resolve = (field: StyledField): CharStyle | undefined => {
    const fieldStyle = fields?.[field];
    if (fieldStyle === false) {
      return undefined;
    }
    const merged = mergeCharStyle(base ?? {}, fieldStyle ?? {});
    applyCharStyle('', merged);
    return merged;
  };
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
 * オプションを検査し、項目ごとの字形の指定を default とマージしておく
 *
 * 字形の指定は mergeCharStyle が作る写しなので、あとで options を書き換えても結果は変わらない。
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

/**
 * buildResult.ts
 *
 * @description 解析の結果と切れ目の探索の結果から、出力を組み立てる
 */

import {
  applyCharStyle,
  guardedNfkc,
  mergeCharStyle,
} from '@arihirookazaki/normalize-core';
import type { ParsedAddress } from '../ports/addressParser.ts';
import type {
  AddressResult,
  AddressStyle,
  NormalizeAddressOptions,
  StyledField,
} from '../ports/addressResult.ts';
import type { SplitOutcome } from './split.ts';

/**
 * 項目に字形の指定を当てる
 *
 * ガード付き NFKC をかけたあと、default に項目ごとの指定をマージしたものを当てる。項目ごとの指定が false なら当てない。
 *
 * @param field - 項目
 * @param text - 項目の文字列
 * @param style - 字形の指定
 * @returns 字形をそろえた文字列
 * @throws {TypeError} 字形の指定が検査を満たさない場合
 */
export const styleField = (
  field: StyledField,
  text: string,
  style: AddressStyle = {},
): string => {
  const normalized = guardedNfkc(text);
  const fieldStyle = style.fields?.[field];
  if (fieldStyle === false) {
    return normalized;
  }
  return applyCharStyle(
    normalized,
    mergeCharStyle(style.default ?? {}, fieldStyle ?? {}),
  );
};

/**
 * 出力を組み立てる
 *
 * 住所の項目・level・point・codes は切れ目の探索の結果が指す解析の結果から、other と building は切れ目の探索の結果から、
 * nja は全体の結果から取る。
 *
 * @param input - 渡された文字列
 * @param whole - テキスト全体の解析の結果
 * @param outcome - 切れ目の探索の結果
 * @param options - normalizeAddress のオプション
 * @returns 出力
 * @throws {TypeError} 字形の指定が検査を満たさない場合
 */
export const buildResult = (
  input: string,
  whole: ParsedAddress,
  outcome: SplitOutcome,
  options: NormalizeAddressOptions | undefined,
): AddressResult => {
  const style = options?.style;
  const { address } = outcome;
  const optional = (field: StyledField, value: string | undefined) =>
    value === undefined ? {} : { [field]: styleField(field, value, style) };
  return {
    input,
    ...optional('prefecture', address.prefecture),
    ...optional('city', address.city),
    ...optional('town', address.town),
    ...optional('number', address.number),
    building: styleField('building', outcome.building, style),
    other: styleField('other', outcome.other, style),
    level: address.level,
    ...(address.point === undefined ? {} : { point: { ...address.point } }),
    split: outcome.split,
    ...(options?.codes === true
      ? {
          codes: {
            ...(address.lgCode === undefined ? {} : { lgCode: address.lgCode }),
            ...(address.machiazaId === undefined
              ? {}
              : { machiazaId: address.machiazaId }),
          },
        }
      : {}),
    ...(options?.nja === true ? { nja: whole.raw } : {}),
  };
};

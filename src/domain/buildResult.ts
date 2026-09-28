/**
 * buildResult.ts
 *
 * @description 解析の結果と切れ目の探索の結果から、出力を組み立てる
 */

import {
  applyCharStyle,
  guardedNfkc,
  type CharStyle,
} from '@arihirookazaki/normalize-core';
import type { ParsedAddress } from '../ports/addressParser.ts';
import type { AddressResult, StyledField } from '../ports/addressResult.ts';
import type { PreparedOptions } from './options.ts';
import type { SplitOutcome } from './split.ts';

/**
 * 項目に字形の指定を当てる
 *
 * ガード付き NFKC をかけたあと、字形の指定を当てる。指定が undefined なら当てない。
 *
 * @param text - 項目の文字列
 * @param style - prepareOptions がマージと検査を済ませた項目の字形の指定
 * @returns 字形をそろえた文字列
 */
export const styleField = (
  text: string,
  style: CharStyle | undefined,
): string => {
  const normalized = guardedNfkc(text);
  return style === undefined ? normalized : applyCharStyle(normalized, style);
};

/**
 * 出力を組み立てる
 *
 * 住所の項目・level・point・codes は切れ目の探索の結果が指す解析の結果から、unmatched と building は切れ目の探索の結果から、
 * nja は全体の結果から取る。
 *
 * @param input - 渡された文字列
 * @param whole - テキスト全体の解析の結果
 * @param outcome - 切れ目の探索の結果
 * @param options - prepareOptions が検査とマージを済ませたオプション
 * @returns 出力
 */
export const buildResult = (
  input: string,
  whole: ParsedAddress,
  outcome: SplitOutcome,
  options: PreparedOptions,
): AddressResult => {
  const { styles } = options;
  const { address } = outcome;
  const optional = (field: StyledField, value: string | undefined) =>
    value === undefined ? {} : { [field]: styleField(value, styles[field]) };
  return {
    input,
    ...optional('prefecture', address.prefecture),
    ...optional('city', address.city),
    ...optional('town', address.town),
    ...optional('block', address.block),
    building: styleField(outcome.building, styles.building),
    unmatched: styleField(outcome.unmatched, styles.unmatched),
    level: address.level,
    ...(address.point === undefined ? {} : { point: { ...address.point } }),
    split: outcome.split,
    ...(options.codes
      ? {
          codes: {
            ...(address.lgCode === undefined ? {} : { lgCode: address.lgCode }),
            ...(address.machiazaId === undefined
              ? {}
              : { machiazaId: address.machiazaId }),
          },
        }
      : {}),
    ...(options.nja ? { nja: whole.raw } : {}),
  };
};

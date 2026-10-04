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
import type { SplitOutcome } from './split/outcome.ts';

/**
 * 項目に字形の指定を当てる（docs/design.md の「字形の指定」）
 *
 * @param text - 項目の文字列
 * @param style - prepareOptions がマージと検査を済ませた項目の字形の指定。undefined なら当てない
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
 * 出力を組み立てる（docs/design.md の出力の表）
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
  const { fieldsFrom } = outcome;
  const field = (name: StyledField, value: string | null): string | null =>
    value === null ? null : styleField(value, styles[name]);
  return {
    input,
    prefecture: field('prefecture', fieldsFrom.prefecture),
    city: field('city', fieldsFrom.city),
    town: field('town', fieldsFrom.town),
    block: field('block', fieldsFrom.block),
    building: styleField(outcome.building, styles.building),
    unmatched: styleField(outcome.unmatched, styles.unmatched),
    level: fieldsFrom.level,
    point: fieldsFrom.point === null ? null : { ...fieldsFrom.point },
    split: outcome.split,
    ...(options.codes
      ? {
          codes: {
            lgCode: fieldsFrom.lgCode,
            machiazaId: fieldsFrom.machiazaId,
          },
        }
      : {}),
    ...(options.nja ? { nja: whole.raw } : {}),
  };
};

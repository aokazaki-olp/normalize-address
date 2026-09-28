/**
 * outcome.ts
 *
 * @description 切れ目の探索の結果と、docs/design.md の出力の表の列ごとの組み立て
 */

import type { ParsedAddress } from '../../ports/addressParser.ts';
import type { SplitStatus } from '../../ports/addressResult.ts';

/** 切れ目で切った結果 */
export interface FoundOutcome {
  readonly split: 'found';
  /** 住所の項目・level・point・codes を取る解析の結果 */
  readonly fieldsFrom: ParsedAddress;
  readonly unmatched: string;
  /** 建物部（空でない） */
  readonly building: string;
}

/** 切らなかった結果 */
export interface UnsplitOutcome {
  readonly split: Exclude<SplitStatus, 'found'>;
  /** 住所の項目・level・point・codes を取る解析の結果（全体の結果） */
  readonly fieldsFrom: ParsedAddress;
  readonly unmatched: string;
  readonly building: '';
}

/** 切れ目の探索の結果 */
export type SplitOutcome = FoundOutcome | UnsplitOutcome;

/**
 * 手順4（建物部の始まりの位置）で切った結果を作る
 *
 * @param front - 前半の解析の結果
 * @param building - 後半から取り出した建物部（空でない）
 * @returns 住所の項目と unmatched を前半の結果から取る結果
 */
export const foundAtBuildingStart = (
  front: ParsedAddress,
  building: string,
): FoundOutcome => ({
  split: 'found',
  fieldsFrom: front,
  unmatched: front.unmatched,
  building,
});

/**
 * 手順6（切れ目の候補）で切った結果を作る
 *
 * @param whole - テキスト全体の解析の結果
 * @param front - 前半の解析の結果
 * @param building - 後半から取り出した建物部（空でない）
 * @returns 住所の項目を全体の結果から、unmatched を前半の結果から取る結果
 */
export const foundAtCandidate = (
  whole: ParsedAddress,
  front: ParsedAddress,
  building: string,
): FoundOutcome => ({
  split: 'found',
  fieldsFrom: whole,
  unmatched: front.unmatched,
  building,
});

/**
 * 切らなかった結果を作る
 *
 * @param whole - テキスト全体の解析の結果
 * @param split - 切らなかった理由
 * @returns 住所の項目と unmatched を全体の結果から取り、建物部が空の結果
 */
export const unsplit = (
  whole: ParsedAddress,
  split: UnsplitOutcome['split'],
): UnsplitOutcome => ({
  split,
  fieldsFrom: whole,
  unmatched: whole.unmatched,
  building: '',
});

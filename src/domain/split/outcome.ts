/**
 * outcome.ts
 *
 * @description 切れ目の探索の結果
 */

import type { ParsedAddress } from '../../ports/addressParser.ts';
import type { SplitStatus } from '../../ports/addressResult.ts';

/** 切れ目の探索の結果 */
export interface SplitOutcome {
  split: SplitStatus;
  /** 住所の項目・level・point を取る解析の結果 */
  address: ParsedAddress;
  unmatched: string;
  building: string;
}

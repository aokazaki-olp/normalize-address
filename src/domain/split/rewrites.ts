/**
 * rewrites.ts
 *
 * @description NJA が読み誤る書き方を、解析の前に書き換える
 */

import { KYOTO_STREET, LISTED_LOT_BANCHI, OYOBI } from './rules.ts';

/**
 * NJA が読み誤る書き方を、解析の前に書き換える（docs/design.md の手順1）
 *
 * @param text - 住所の番号の中の空白を消したテキスト
 * @returns 京都市（`京都府` を付けたもの、空白をはさんだものを含む）で始まる入力の区のあとの通り名（続く N丁目 を含む。ただし N丁目 のあとが算用数字・空白なら N丁目 は残す。区と通り名の間に空白・数字・番号の形の漢数字が無く、あとに空白・数字でない字が続くとき）を外し、`、`・`及び` のあとの `N番地M` をすべて `N-M` にし、`および` を `及び` にしたテキスト
 */
export const rewriteForParser = (text: string): string =>
  text
    .replace(KYOTO_STREET, '$1')
    .replace(OYOBI, '及び')
    .replace(LISTED_LOT_BANCHI, '-');

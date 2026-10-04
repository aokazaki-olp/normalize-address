/**
 * rewrites.ts
 *
 * @description NJA が読み誤る書き方を、解析の前に書き換える
 */

import { KYOTO_CITY, KYOTO_STREET, LISTED_LOT_BANCHI, OYOBI } from './rules.ts';

/**
 * NJA が読み誤る書き方を、解析の前に書き換える（docs/design.md の手順1）
 *
 * @param text - 住所の番号の中の空白を消したテキスト
 * @returns 京都市の通り名を外し、列挙の2つ目からの `N番地M` を `N-M` にし、`および` を `及び` にしたテキスト
 */
export const rewriteForParser = (text: string): string => {
  const withoutStreet = KYOTO_CITY.test(text)
    ? text.replace(KYOTO_STREET, '$1')
    : text;
  return withoutStreet.replace(OYOBI, '及び').replace(LISTED_LOT_BANCHI, '-');
};

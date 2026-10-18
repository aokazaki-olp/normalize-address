/**
 * prefectureCandidates.ts
 *
 * @description 都道府県の無い入力が同じ名前の市区町村で始まるときの、都道府県の候補と、その中から最も良い解析の結果を選ぶこと
 */

import type { ParsedAddress } from '../ports/addressParser.ts';

// JAv2 の ja.json（meta.updated 1735102668、2026-10-05 取得）で、都道府県の異なる同じ名前の市区町村。NJA 3.1.3 は都道府県が無いと、町字まで読めた候補の最後を採る
const SAME_NAME_CITIES: Readonly<Record<string, readonly string[]>> = {
  伊達市: ['北海道', '福島県'],
  松前町: ['北海道', '愛媛県'],
  森町: ['北海道', '静岡県'],
  日高町: ['北海道', '和歌山県'],
  清水町: ['北海道', '静岡県'],
  池田町: ['北海道', '福井県', '長野県', '岐阜県'],
  南部町: ['青森県', '山梨県', '鳥取県'],
  川崎町: ['宮城県', '福岡県'],
  美里町: ['宮城県', '埼玉県', '熊本県'],
  美郷町: ['秋田県', '島根県', '宮崎県'],
  朝日町: ['山形県', '富山県', '三重県'],
  金山町: ['山形県', '福島県'],
  川西町: ['山形県', '奈良県'],
  小国町: ['山形県', '熊本県'],
  昭和村: ['福島県', '群馬県'],
  南牧村: ['群馬県', '長野県'],
  高山村: ['群馬県', '長野県'],
  明和町: ['群馬県', '三重県'],
  府中市: ['東京都', '広島県'],
  美浜町: ['福井県', '愛知県', '和歌山県'],
  川上村: ['長野県', '奈良県'],
  高森町: ['長野県', '熊本県'],
  日野町: ['滋賀県', '鳥取県'],
  太子町: ['大阪府', '兵庫県'],
  広川町: ['和歌山県', '福岡県'],
};

/**
 * 都道府県の無い入力が同じ名前の市区町村で始まるときの、都道府県の候補を返す（docs/design.md の手順2）
 *
 * @param text - 解析に渡すテキスト。先頭の空白は落として判定する
 * @returns 都道府県の候補。当たらなければ空
 */
export const prefectureCandidates = (text: string): readonly string[] => {
  const city = Object.keys(SAME_NAME_CITIES).find((name) =>
    text.trimStart().startsWith(name),
  );
  return city === undefined ? [] : (SAME_NAME_CITIES[city] ?? []);
};

const parseScore = (parsed: ParsedAddress): number =>
  parsed.level * 1000 +
  (parsed.town ?? '').length * 10 -
  parsed.unmatched.length;

/**
 * 都道府県の候補を付けて解析した結果から、最も良いものを選ぶ（docs/design.md の手順2）
 *
 * level、町字の長さ、unmatched の短さで比べる。
 *
 * @param tried - 候補ごとの解析の結果
 * @returns 最も良いもの。候補が無いか、最も良いものが同点で2つ以上あれば undefined
 */
export const bestCandidate = <T extends { readonly whole: ParsedAddress }>(
  tried: readonly T[],
): T | undefined => {
  const [best, second] = tried.toSorted(
    (a, b) => parseScore(b.whole) - parseScore(a.whole),
  );
  if (
    best === undefined ||
    (second !== undefined && parseScore(best.whole) <= parseScore(second.whole))
  ) {
    return undefined;
  }
  return best;
};

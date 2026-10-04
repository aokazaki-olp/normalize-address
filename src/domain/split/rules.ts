/**
 * rules.ts
 *
 * @description 住所部と建物部の切れ目の判定に使う規則のデータと、それから組み立てた正規表現
 */

// 先頭・末尾の replace で最長の接尾語を落とすため、前方が同じものは長いものを先に置く
const ADDRESS_SUFFIXES = [
  '号',
  '番地先',
  '番先',
  '番地',
  '番',
  '地先',
  '地',
] as const;
const NUMBER_SEPARATORS = [
  '-',
  '番地の',
  '番地',
  '番の',
  '番-',
  '番',
  '号',
  'の',
  'ノ',
  '街区',
  '区',
] as const;
// 号の直後の数字は階・部屋の番号のことが多いため、住所の末尾の区切りには号を入れない
const TAIL_SEPARATORS = NUMBER_SEPARATORS.filter(
  (separator) => separator !== '号',
);
const ROOM_SUFFIXES = ['号室', '室'] as const;
// level 3 で住所の番号として取る数。住居表示は街区符号-住居番号、地番は本番-支号（不動産登記事務取扱手続準則67条1項(9)「支号の支号は用いない」）
export const ADDRESS_NUMBER_LIMIT = 2;
// 3つ目の番号を住所に残す桁数の上限。住居表示では住居番号2（団地の○番○―○号）、地番では丁目・地割を読めなかったときの番号や古い支号の支号
export const THIRD_NUMBER_MAX_DIGITS = 2;
// NJA 3.1.3 の正規表現が対象にする漢数字（docs/nja-3.1.3-char-rules.md）
const KANJI_NUMERALS = '〇一二三四五六七八九十百千';
// NJA 3.1.3 が横棒として扱う字（normalize-core の HORIZONTAL_BAR と同じ集合。normalize-core が公開していないため写す）
const HORIZONTAL_BARS = String.raw`-\uff0d\ufe63\u2212\u2010\u2043\u2011\u2012\u2013\u2014\ufe58\u2015\u23af\u23e4\u30fc\uff70\u2500\u2501`;
const CUT_AFTER_ANY = '号地';
const CUT_AFTER_NUMBER_END = '番目';
const NUMBER_CONTINUATION = '号番地';

const DIGIT = '[0-9]';
const DIGITS = '[0-9]+';
const group = (items: readonly string[]): string => `(?:${items.join('|')})`;
const SUFFIX = group(ADDRESS_SUFFIXES);
const ROOM_SUFFIX = group(ROOM_SUFFIXES);
const F_NOT_WORD = '(?![A-Za-z])';
const F_CLEAR_END = String.raw`(?=$|[\s0-9・、,(])`;

export const BEFORE_ANY = new RegExp(`^[${CUT_AFTER_ANY}]$`, 'u');
export const BEFORE_NON_NUMBER = new RegExp(
  `^[0-9${KANJI_NUMERALS}${CUT_AFTER_NUMBER_END}]$`,
  'u',
);
export const NUMBER_PART = new RegExp(`^[0-9${NUMBER_CONTINUATION}]$`, 'u');
export const LEADING_TAIL_NUMBER = new RegExp(
  `^${DIGITS}(?:${group(TAIL_SEPARATORS)}${DIGITS})*`,
  'u',
);
export const NON_DIGITS = /[^0-9]+/gu;
export const LEADING_SUFFIX = new RegExp(`^${SUFFIX}`, 'u');
export const TRAILING_SUFFIX = new RegExp(`${SUFFIX}$`, 'u');
export const LEADING_BARS = new RegExp(`^[${HORIZONTAL_BARS}]+`, 'u');
// 京都市の通り名（`…上ル` `…西入` など）。NJA 3.1.3 は京都市の町字を後方一致で照合するため、建物名の中の町名に当たる（docs/design.md の手順1）
export const KYOTO_CITY = /(?<!東)京都市/u;
export const KYOTO_STREET =
  /^(.*?区)[^\s0-9]*?(?:[上下][るル]|[東西]入[るル]?)(?![るル])(?=[^\s0-9])/u;
// 列挙の2つ目からの `N番地M`。NJA 3.1.3 の後処理が `N番地` を `N` にして番号がつながる（`、1444番地1` → `、14441`）
export const LISTED_LOT_BANCHI = new RegExp(
  `(?<=(?:、|及び)${DIGITS})番地(?=${DIGIT})`,
  'gu',
);
export const OYOBI = /および/gu;
// 住所の番号の中の空白（docs/design.md の手順1）。横棒のまわりと、番のあとの号で閉じた番号（住居表示の「○番○号」「○番○―○号」）の前、番号のあとの接尾語だけの前
export const SPACE_IN_NUMBER = new RegExp(
  [
    `(?<=${DIGIT}[${HORIZONTAL_BARS}]) +(?=${DIGIT})`,
    `(?<=${DIGIT}) +(?=[${HORIZONTAL_BARS}]${DIGIT})`,
    `(?<=${DIGIT}番) +(?=${DIGITS}(?:[${HORIZONTAL_BARS}]${DIGITS})?号(?!室|棟|館|地))`,
    `(?<=${DIGIT}) +(?=(?:号|番地|番)(?:$| |${DIGIT}|[外先内]))`,
  ].join('|'),
  'gu',
);
export const FIRST_ASCII_DIGIT = new RegExp(DIGIT, 'u');
export const FRONT_UNMATCHED = new RegExp(
  `^${DIGITS}(?:${group(NUMBER_SEPARATORS)}${DIGITS})*${SUFFIX}?$`,
  'u',
);
export const ENDS_AS_ADDRESS = new RegExp(
  `${group([DIGIT, ...ADDRESS_SUFFIXES])}$`,
  'u',
);
export const CONTINUES_ADDRESS = new RegExp(
  `^(?:${group([...ADDRESS_SUFFIXES, '[のノ]'])}(?=${DIGIT})|線)`,
  'u',
);
export const FLOOR_AFTER_BAR = new RegExp(
  `^${DIGITS}(?:階|F${F_NOT_WORD})`,
  'u',
);
export const FLOOR_AFTER_SPACE = new RegExp(
  `^${DIGITS}(?:階|F${F_CLEAR_END})`,
  'u',
);
export const ROOM = new RegExp(`^${DIGITS}${ROOM_SUFFIX}`, 'u');
export const FLOOR_OR_ROOM_MARK = new RegExp(
  `^(?:階|F${F_NOT_WORD}|${ROOM_SUFFIX})`,
  'u',
);
// 地番の列挙・合併の続き（`、N番地`、`・N合併地`、`甲N`、`第N`、`及び漢N番地`）。読点・中黒は数字が続くときだけ列挙とみなす（`カ・カ` の建物名を止めない）
const LIST_MARK = '[、,.・]';
const BRANCH_MARK = '[甲乙丙丁戊]';
const MERGE_WORDS = [
  '合併地',
  '合併',
  '合筆地',
  '合筆',
  '合番地',
  '合地',
  '合',
] as const;
// 番号の前の地名は、字のあとか、N番地が続くときだけ（`本館2番` のような建物の中の名前を通さない）
const PLACE_BEFORE_NUMBER = String.raw`(?:字(?:(?!及び)[\p{sc=Han}々]){1,3}|[\p{sc=Han}々]{1,3}(?=${DIGITS}番地))`;
// 部屋番号の列挙（`101・102号`）を通さないよう、号は N番N のあとだけ
const LOT_GO = '(?<=番[0-9]+)号';
// 住所の語（番・地・合・甲乙・及び・いろは）を含むか、読点で始まる番号の列挙だけを住所の続きとみなす（数字で始まる `1、2`・`101・102` の部屋の列挙を通さない）
const ADDRESS_WORD = `(?:(?=.*(?:番|地|合|[甲乙丙丁戊]|及び|[のノ][イロハニホヘト]$))|(?=、${DIGIT}))`;
const IROHA_END = '[のノ][イロハニホヘト]$';
const BEFORE_IROHA = '(?![イロハニホヘト]$)';
// 1つのトークンを、当たった形から戻らずに取る（`(?=(…))\\k<token>`）。数字の並びや「番地」と「番」「地」の取り方が分かれて、長い入力で指数時間になるのを防ぐ
const LIST_TOKEN = `(?=(?<token>${group([
  IROHA_END,
  PLACE_BEFORE_NUMBER,
  DIGITS,
  ...TAIL_SEPARATORS.map((separator) =>
    separator.endsWith('の') ? `${separator}${BEFORE_IROHA}` : separator,
  ),
  LOT_GO,
  '地',
  `[${HORIZONTAL_BARS}]`,
  LIST_MARK,
  BRANCH_MARK,
  '第',
  '及び',
  ...MERGE_WORDS,
])}))\\k<token>`;
const LIST_START = group([
  `${LIST_MARK}${DIGIT}`,
  `${DIGITS}(?:${group(NUMBER_SEPARATORS)}${DIGITS})*${SUFFIX}?${LIST_MARK}${DIGIT}`,
  '及び',
  `合併${DIGIT}`,
  `${BRANCH_MARK}${DIGIT}`,
  `第${DIGIT}`,
  PLACE_BEFORE_NUMBER,
]);
export const ADDRESS_LIST = new RegExp(
  `^(?=${LIST_START})(?=.*${DIGIT})${ADDRESS_WORD}(?:${LIST_TOKEN})*$`,
  'u',
);
// 住所の範囲を表す接尾語（地先・地内・番地先・の内・外）。建物ではない
const ADDRESS_MODIFIERS = [
  '番地先',
  '番先',
  '番地内',
  '地先',
  '地内',
  'の内',
  '先',
  '内',
  '外',
] as const;
// N番地・N番のあとの第N（第N号）は地番の枝番
export const LOT_END = /番地?$/u;
export const DAI_BRANCH = /^第[0-9]+号?$/u;
export const ADDRESS_MODIFIER = new RegExp(
  `^${group(ADDRESS_MODIFIERS)}$`,
  'u',
);
export const FLOOR_MARK_ONLY = new RegExp(`^(?:階|F${F_NOT_WORD})$`, 'u');
// 0 だけの階は無いので、最後の1字が 0 なら1桁を階に回さない
export const FLOOR_DIGIT_END = /[0-9][1-9]$/u;
export const DIGIT_RUNS = /[0-9]+/gu;
const NUMBER_CHARS = `0-9${KANJI_NUMERALS}`;
// 元のテキストの番号（算用数字か漢数字）と、そのあとのつなぎ（数字と空白以外の4字まで）
export const ORIGINAL_NUMBER = new RegExp(
  `(?<![${NUMBER_CHARS}])([${NUMBER_CHARS}]+)`,
  'uy',
);
export const ORIGINAL_NUMBER_START = new RegExp(
  `(?<![${NUMBER_CHARS}])[${NUMBER_CHARS}]`,
  'gu',
);
export const ORIGINAL_JOINER_AT = new RegExp(
  `([^${NUMBER_CHARS}\\s]{1,4})`,
  'uy',
);
// NJA は other の空白を消すので、番号と空白のあとの階の数字（`M 3F`）は元のテキストで分ける
export const SPACED_FLOOR = new RegExp(
  `(?<![0-9])([0-9]+)\\s+([0-9]+)(?=階|F${F_NOT_WORD})`,
  'gu',
);
export const ASCII_DIGITS = /^[0-9]+$/u;
export const KANJI_DIGIT_VALUES = '〇一二三四五六七八九';
export const KANJI_UNIT_VALUES: Readonly<Record<string, number>> = {
  十: 10,
  百: 100,
  千: 1000,
};
// 「の」「番地の」「番の」「ノ」でつながる番号は筆（地番の続き）として住所に残す
export const LOT_JOINER = /[のノ]$/u;
export const BLOCK_SEPARATOR = /区$/u;
export const LEADING_DIGIT = new RegExp(`^${DIGIT}`, 'u');
export const SUFFIX_ONLY = new RegExp(`^${SUFFIX}$`, 'u');
export const LEADING_SPACE = /^\s/u;
export const LEADING_DIGITS = new RegExp(`^${DIGITS}`, 'u');
export const LEADING_KANJI_NUMERAL = new RegExp(`^[${KANJI_NUMERALS}]`, 'u');
export const ROOM_AFTER_NUMBERS = new RegExp(
  `(?<![0-9-])${DIGITS}(?:-${DIGITS}){2,}(-)${DIGITS}${ROOM_SUFFIX}`,
  'du',
);

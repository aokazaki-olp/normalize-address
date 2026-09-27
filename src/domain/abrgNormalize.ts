/**
 * abrgNormalize.ts
 *
 * @description abr-geocoder 3.0.51 の住所番号の切り分け規則の移植（THIRD_PARTY_NOTICES）
 */

import {
  concatTracked,
  insertTracked,
  insertedText,
  replaceTracked,
  sliceTracked,
  type TrackedText,
} from './trackedText.ts';

/** 住所の型（abr-geocoder の NormalizeCategory の値） */
export type AddressType = 'rsdtdsp' | 'parcel' | 'undetermined' | 'unknown';

/** normalizeBasicNormalized の結果 */
export interface FormattedAddress {
  text: TrackedText;
  addressType: AddressType;
}

interface ReplaceRule {
  pattern: RegExp;
  template: string;
}

// Go の unicode.IsSpace と同じ集合
const GO_SPACE =
  /^[\t\n\v\f\r \u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]$/u;
const ASCII_DIGIT = /^[0-9]$/u;

const DASHES = new Set([
  '\u2010',
  '\u2011',
  '\u2012',
  '\u2013',
  '\u2014',
  '\u2015',
  '\u2212',
  '\u2500',
  '\u2501',
  '\u2796',
  '\ufe63',
  '\uff0d',
  '\u207b',
  '\u208b',
  '\u2043',
  '\u301c',
  '\u3030',
]);

const KATAKANA_DASH = /([\d０-９])ー([\d０-９])/dgu;

const BAN_GAI_WITH_BUILDING = /(\d+番街)[\t\n\f\r ]*(\d+(?:号|棟))/dgu;
const BAN_GAI = /(\d+)番街/dgu;
const FIRST_BAN_GAI = /(\d+)番街/u;
const BAN_SAKI_NOT_END = /(\d+番先)([^\t\n\f\r ])/dgu;
const BAN_GO_WITH_ALPHANUMERIC = /(\d+)番(\d+)(-[A-Za-z][A-Za-z0-9]*)号/dgu;
const BAN_GO_SHITSU = /(\d+)番(\d+)-(\d+)号室/dgu;
const BAN_GO_SPACE = /(\d+)番(\d+(?:-\d+)*)号[\t\n\f\r ]/dgu;
const BAN_GO_WITH_BUILDING = /(\d+)番(\d+(?:-\d+)*)号([^\d\t\n\f\r ])/dgu;
const BAN_GO_WITH_ROOM_NUM = /(\d+)番(\d+(?:-\d+)*)号(\d)/dgu;
const BAN_NO = /(\d+)番[のノ](\d+)/dgu;
const BAN_NO_GO = /(\d+)番(\d+)[のノ](\d+)号/dgu;
const BAN_TOU = /(\d+)番(\d+)棟/dgu;
const BAN_WITH_HYPHEN_NUMERIC = /(\d+)番(\d+)(-\d+)/dgu;
const BAN_WITH_HYPHEN_ALPHANUMERIC = /(\d+)番(\d+)(-[A-Za-z][A-Za-z0-9]*)/dgu;
const BAN_WITH_BUILDING = /(\d+)番(\d+)([^\d\t\n\f\r -][^\n]*)/dgu;
const BAN = /(\d+)番(\d+)/dgu;
const BAN_ONLY = /(\d+)番$/dgu;
const BAN_KEEP_CHARS = '街館先屋戸町地耕ケ川通丁内';
const BAN_BUILDING = new RegExp(`(\\d+)番([^\\d${BAN_KEEP_CHARS}])`, 'dgu');
const BAN_HYPHEN_GO = /(\d+)番-(\d+)号/dgu;
const BAN_HYPHEN = /(\d+)番-(\d+)/dgu;

const BRANCH_CHARS = 'ぁ-んァ-ヶ甲乙丙丁戊己庚辛壬癸子丑寅卯夘辰巳午未申酉戌亥';
const BANCHI_GO_TOU = /(\d+)番地(\d+)号棟/dgu;
const BANCHI_TOU = /(\d+)番地(\d+)棟/dgu;
const BANCHI_GO = /(\d+)番地(\d+)号/dgu;
const BANCHI_NO = /(\d+)番地[のノ](\d+)/dgu;
const BANCHI_NO_GO = /(\d+)番地[のノ](\d+)号/dgu;
const BANCHI_HYPHEN_GO = /(\d+)番地-(\d+)号/dgu;
const BANCHI_HYPHEN = /(\d+)番地-(\d+)/dgu;
const BANCHI_WITH_HYPHEN_NUMERIC = /(\d+)番地(\d+)(-\d+)/dgu;
const BANCHI_END = /(\d+)番地(\d+)$/dgu;
const BANCHI_BUILDING = /(\d+)番地(\d+)([^\d\t\n\f\r -])/dgu;
const BANCHI_SAKI_NOT_END = /(\d+番地先)([^\t\n\f\r ])/dgu;
const BANCHI_SINGLE_END = /(\d+)番地$/dgu;
const BANCHI_SINGLE_NOT_END = /(\d+)番地([^\d\-先])/dgu;
const BANCHI_BRANCH_WITH_NO = new RegExp(
  `(\\d+)番地[のノ]([${BRANCH_CHARS}])([^${BRANCH_CHARS}ー一-龯]|$)`,
  'dgu',
);
const BANCHI_BRANCH_END = new RegExp(`(\\d+)番地([${BRANCH_CHARS}])$`, 'dgu');

const BANCHO_KEEP_CHARS = '号F街階丁';
const BANCHO = new RegExp(
  `(番町)(\\d+)([^\\d\\t\\n\\f\\r \\-${BANCHO_KEEP_CHARS}])`,
  'dgu',
);
const BANCHO_HYPHEN_BUILDING = /(番町\d+-\d+)([^\d\t\n\f\r \-号])/dgu;
const BANCHO_BANCHI = /(\d+番町)(\d+)番地(\d+)/dgu;
const BANCHO_BAN_GO = /(番町)(\d+)番(\d+)号/dgu;
const BANCHO_BAN_WITH_NUMBER = /(番町)(\d+)番(\d+)/dgu;
const BANCHO_BAN_ONLY = /(番町)(\d+)番([^\d])/dgu;
const BANCHO_BAN_END = /(番町)(\d+)番$/dgu;

const CHOME_BAN_KEEP_CHARS = 'の街先屋戸地';
const CHOME = /(丁目)(\d+)番$/dgu;
const CHOME_NOT_END = new RegExp(
  `(丁目)(\\d+)番([^\\d${CHOME_BAN_KEEP_CHARS}])`,
  'dgu',
);

const GOCHI = /(\d+号地)(\d*)/dgu;
const ROOM_NUMBER = /(\d+(?:-\d+)+)-(\d+室)/dgu;
const FLOOR_NUMBER = /(\d+(?:-\d+)*)-(\d+(?:F|階))/dgu;

const FIRST_ARABIC = /([\d]+(?:-[\d]+)+)/u;
const SPACE_BEFORE_NO = / ([のノ]\d+)/dgu;
const TRAILING_GO = /(\d+-\d+(?:-\d+)*\d+)号$/dgu;
const NUMBER_BEFORE_JAPANESE = /(\d)([ァ-ヶぁ-ん一-龯])/du;

const NO_DIGIT_KEEP_CHARS = '号町丁';
const DIGIT_NO_DIGIT_GO = /(\d)([のノ])(\d+)号([^\d\t\n\f\r ])/dgu;
const DIGIT_NO_DIGIT_GO_END = /(\d)([のノ])(\d+)号([\t\n\f\r ]|$)/dgu;
const DIGIT_NO_DIGIT = new RegExp(
  `(\\d)([のノ])(\\d+)([^\\d\\t\\n\\f\\r ${NO_DIGIT_KEEP_CHARS}])`,
  'dgu',
);
const DIGIT_NO_DIGIT_END = /(\d)([のノ])(\d+)([\t\n\f\r ]|$)/dgu;

const NO_SPACE_COMPONENTS = [
  '街区',
  '丁目',
  '番地',
  '番',
  '号',
  '\u7dda',
  '地割',
  '分区',
  '基線',
  '\u6761',
];

const ADDRESS_COMPONENTS = [
  '丁目',
  '番地',
  '番丁',
  '番内',
  '番',
  '号',
  '\u68df',
  '\u968e',
  '\u5ba4',
  '\u7dda',
  '地割',
  '\u533a',
  '街区',
  '\u6761',
  '基線',
  '分区',
  '基北',
  '基南',
  'の通',
  '番通',
  '町内会',
  '林班',
  '\u5b57',
  '\u4e01',
  'ノ町',
  'の町',
  '\u90e8',
  '本通',
  '本松',
  '本杉',
  '本柳',
  '本木',
  'の坪',
  'ノ坪',
  'ケ村',
  'ヶ村',
  'か村',
  'カ村',
];

const ADDRESS_MARKERS = [
  '番',
  '号',
  'の',
  'ノ',
  '室',
  '階',
  '棟',
  '町',
  '丁目',
];
const DIGIT_BEFORE_F = /\dF/u;
const HAS_ASCII_DIGIT = /\d/u;
const NO_BEFORE_DIGIT = /[のノ]\d/u;

const PATTERN_BANCHI_GO = /\d+番地\d+(?:-\d+)*号/u;
const PATTERN_BAN_GO = /\d+番\d+(?:-[A-Za-z0-9]+)*号/u;
const PATTERN_BAN = /\d+番\d+$/u;
const PATTERN_BAN_ONLY = /\d+番$/u;
const PATTERN_BANCHI = /\d+番地/u;
const PATTERN_ARABIC_DASH = /\d+-\d+/u;

const PUNCTUATION = /[(),、]/u;
const ROOM_OR_FLOOR = /[室F階]/u;

const rule = (pattern: RegExp, template: string): ReplaceRule => ({
  pattern,
  template,
});

const ROOM_FLOOR_RULES = [
  rule(ROOM_NUMBER, '$1 -$2'),
  rule(FLOOR_NUMBER, '$1 -$2'),
];

const ILLEGAL_BANCHI_RULES = [
  rule(BANCHI_GO_TOU, '$1 $2号棟'),
  rule(BANCHI_TOU, '$1 $2棟'),
  rule(BANCHI_GO, '$1-$2'),
];

const BANCHI_RULES = [
  rule(BANCHI_NO_GO, '$1-$2'),
  rule(BANCHI_NO, '$1-$2'),
  rule(BANCHI_BRANCH_WITH_NO, '$1-$2$3'),
  rule(BANCHI_BRANCH_END, '$1-$2'),
  rule(BANCHI_HYPHEN_GO, '$1-$2'),
  rule(BANCHI_HYPHEN, '$1-$2'),
  rule(BANCHI_WITH_HYPHEN_NUMERIC, '$1-$2$3'),
  rule(BANCHI_BUILDING, '$1-$2 $3'),
  rule(BANCHI_END, '$1-$2'),
  rule(BANCHI_SAKI_NOT_END, '$1 $2'),
  rule(BANCHI_SINGLE_END, '$1'),
  rule(BANCHI_SINGLE_NOT_END, '$1 $2'),
];

const BAN_HYPHEN_RULES = [
  rule(BAN_HYPHEN_GO, '$1-$2'),
  rule(BAN_HYPHEN, '$1-$2'),
];

const BANCHO_RULES = [
  rule(BANCHO_BANCHI, '$1$2-$3'),
  rule(BANCHO_BAN_GO, '$1$2-$3'),
  rule(BANCHO_BAN_WITH_NUMBER, '$1$2-$3'),
  rule(BANCHO_BAN_ONLY, '$1$2$3'),
  rule(BANCHO_BAN_END, '$1$2'),
  rule(BANCHO_HYPHEN_BUILDING, '$1 $2'),
];

const BAN_GO_RULES = [
  rule(BAN_NO_GO, '$1-$2-$3'),
  rule(BAN_GO_WITH_ALPHANUMERIC, '$1-$2 $3'),
  rule(BAN_GO_SHITSU, '$1-$2 -$3号室'),
  rule(BAN_GO_WITH_BUILDING, '$1-$2 $3'),
  rule(BAN_GO_WITH_ROOM_NUM, '$1-$2 $3'),
  rule(BAN_GO_SPACE, '$1-$2 '),
];

const NO_AFTER_DIGIT_RULES = [
  rule(DIGIT_NO_DIGIT_GO, '$1-$3 $4'),
  rule(DIGIT_NO_DIGIT_GO_END, '$1-$3$4'),
  rule(DIGIT_NO_DIGIT, '$1-$3 $4'),
  rule(DIGIT_NO_DIGIT_END, '$1-$3$4'),
];

const GO_AND_POSTFIX_RULES = [
  rule(TRAILING_GO, '$1'),
  rule(GOCHI, '$1$2'),
  rule(BANCHO, '$1$2 $3'),
];

const isAsciiDigit = (char: string): boolean => ASCII_DIGIT.test(char);
const isGoSpace = (char: string): boolean => GO_SPACE.test(char);

const applyRules = (
  tracked: TrackedText,
  rules: readonly ReplaceRule[],
): TrackedText => {
  let result = tracked;
  for (const { pattern, template } of rules) {
    result = replaceTracked(result, pattern, template);
  }
  return result;
};

const applyFirstMatch = (
  tracked: TrackedText,
  rules: readonly ReplaceRule[],
): TrackedText | undefined => {
  for (const { pattern, template } of rules) {
    const next = replaceTracked(tracked, pattern, template);
    if (next.text !== tracked.text) {
      return next;
    }
  }
  return undefined;
};

const trimTracked = (
  tracked: TrackedText,
  isTrimmed: (char: string) => boolean,
  start: boolean,
): TrackedText => {
  const { text } = tracked;
  let begin = 0;
  let end = text.length;
  while (start && begin < end && isTrimmed(text.charAt(begin))) {
    begin++;
  }
  while (end > begin && isTrimmed(text.charAt(end - 1))) {
    end--;
  }
  return sliceTracked(tracked, begin, end);
};

const trimSpace = (tracked: TrackedText): TrackedText =>
  trimTracked(tracked, isGoSpace, true);

/**
 * 空白をそろえる（NormalizeSpaces）
 *
 * 前後の空白を落とし、続いた空白を半角の空白1つにする。空白は Go の unicode.IsSpace の集合。
 *
 * @param tracked - 対象
 * @returns そろえた結果
 */
export const normalizeSpaces = (tracked: TrackedText): TrackedText => {
  const parts: TrackedText[] = [];
  let spaceOrigin: number | undefined;
  let inSpace = true;
  for (let i = 0; i < tracked.text.length; i++) {
    if (isGoSpace(tracked.text.charAt(i))) {
      if (!inSpace) {
        spaceOrigin = tracked.origins[i];
      }
      inSpace = true;
      continue;
    }
    if (inSpace && parts.length > 0) {
      parts.push({ text: ' ', origins: [spaceOrigin ?? -1] });
    }
    parts.push(sliceTracked(tracked, i, i + 1));
    inSpace = false;
  }
  return concatTracked(...parts);
};

/**
 * 横棒をそろえる（NormalizeDashes）
 *
 * 17種の横棒をハイフンマイナスにし、数字に挟まれた「ー」をハイフンマイナスにする。
 *
 * @param tracked - 対象
 * @returns そろえた結果
 */
export const normalizeDashes = (tracked: TrackedText): TrackedText => {
  let result: TrackedText = {
    text: Array.from(tracked.text, (char) =>
      DASHES.has(char) ? '-' : char,
    ).join(''),
    origins: tracked.origins,
  };
  for (;;) {
    const next = replaceTracked(result, KATAKANA_DASH, '$1-$2');
    if (next.text === result.text) {
      return result;
    }
    result = next;
  }
};

/**
 * BasicNormalize のうち、空白と横棒をそろえる部分
 *
 * 引用符・コメント・異体字セレクタの除去と NFKC は行わない。
 *
 * @param tracked - 対象
 * @returns そろえた結果
 */
export const basicNormalize = (tracked: TrackedText): TrackedText =>
  normalizeDashes(normalizeSpaces(tracked));

/**
 * 住所の型を判定する（detectAddressType）
 *
 * @param address - 住所の文字列
 * @returns 住所の型
 */
export const detectAddressType = (address: string): AddressType => {
  const space = address.indexOf(' ');
  const head = space < 0 ? address : address.slice(0, space);
  if (PATTERN_BANCHI_GO.test(head)) {
    return 'undetermined';
  }
  if (PATTERN_BAN_GO.test(head)) {
    return 'rsdtdsp';
  }
  if (PATTERN_BAN.test(head) || PATTERN_BAN_ONLY.test(head)) {
    return 'undetermined';
  }
  if (PATTERN_BANCHI.test(head)) {
    return 'parcel';
  }
  if (PATTERN_ARABIC_DASH.test(head)) {
    return 'undetermined';
  }
  return 'unknown';
};

const hasBanGoPattern = (text: string): boolean => {
  const go = text.indexOf('号');
  if (go < 1) {
    return false;
  }
  const ban = text.slice(0, go).lastIndexOf('番');
  if (ban < 1) {
    return false;
  }
  if (!isAsciiDigit(text.charAt(ban - 1))) {
    return false;
  }
  const between = text.slice(ban + 1, go);
  return between !== '' && isAsciiDigit(between.charAt(0));
};

const hasBanTouPattern = (text: string): boolean => {
  const tou = text.indexOf('棟');
  if (tou < 1) {
    return false;
  }
  if (!isAsciiDigit(text.charAt(tou - 1))) {
    return false;
  }
  const ban = text.slice(0, tou).lastIndexOf('番');
  if (ban < 1) {
    return false;
  }
  return isAsciiDigit(text.charAt(ban - 1));
};

const replaceBanGoEnd = (tracked: TrackedText): TrackedText => {
  const { text } = tracked;
  if (!text.endsWith('号')) {
    return tracked;
  }
  const ban = text.lastIndexOf('番');
  if (ban < 1 || !isAsciiDigit(text.charAt(ban - 1))) {
    return tracked;
  }
  const between = text.slice(ban + 1, text.length - 1);
  if (
    between === '' ||
    !isAsciiDigit(between.charAt(0)) ||
    !Array.from(between).every((char) => isAsciiDigit(char) || char === '-')
  ) {
    return tracked;
  }
  return concatTracked(
    sliceTracked(tracked, 0, ban),
    insertedText('-'),
    sliceTracked(tracked, ban + 1, text.length - 1),
  );
};

const processBanchi = (tracked: TrackedText): TrackedText => {
  let result = tracked;
  if (result.text.includes('番地')) {
    result = applyRules(result, BANCHI_RULES);
  }
  if (result.text.includes('番-')) {
    result = applyRules(result, BAN_HYPHEN_RULES);
  }
  return result;
};

const processBanGai = (tracked: TrackedText): TrackedText => {
  const next = replaceTracked(tracked, BAN_GAI_WITH_BUILDING, '$1 $2');
  if (next.text !== tracked.text) {
    return next;
  }
  const match = FIRST_BAN_GAI.exec(tracked.text);
  if (
    match !== null &&
    match.index > 0 &&
    isAsciiDigit(tracked.text.charAt(match.index - 1))
  ) {
    return replaceTracked(tracked, BAN_GAI, '$1番街 ');
  }
  return tracked;
};

const processBan = (tracked: TrackedText, plainBan: boolean): TrackedText => {
  let result = tracked;
  if (result.text.includes('番街')) {
    result = processBanGai(result);
  }
  if (result.text.includes('番先')) {
    result = replaceTracked(result, BAN_SAKI_NOT_END, '$1 $2');
  }
  if (result.text.includes('棟')) {
    result = replaceTracked(result, BAN_TOU, '$1 $2棟');
  }
  if (result.text.includes('号')) {
    result = replaceBanGoEnd(applyRules(result, BAN_GO_RULES));
  }
  if (result.text.includes('番の') || result.text.includes('番ノ')) {
    result = replaceTracked(result, BAN_NO, '$1-$2');
  }
  if (result.text.includes('丁目')) {
    result = replaceTracked(result, CHOME, '$1$2');
    result = replaceTracked(result, CHOME_NOT_END, '$1$2 $3');
  }
  if (plainBan) {
    if (result.text.includes('-')) {
      result = replaceTracked(result, BAN_WITH_HYPHEN_NUMERIC, '$1-$2$3');
      result = replaceTracked(result, BAN_WITH_HYPHEN_ALPHANUMERIC, '$1-$2 $3');
    }
    result = replaceTracked(result, BAN_WITH_BUILDING, '$1-$2 $3');
    result = replaceTracked(result, BAN, '$1-$2');
  }
  if (result.text.endsWith('番')) {
    result = replaceTracked(result, BAN_ONLY, '$1');
  }
  return replaceTracked(result, BAN_BUILDING, '$1 $2');
};

const processNoPatterns = (tracked: TrackedText): TrackedText => {
  if (!NO_BEFORE_DIGIT.test(tracked.text)) {
    return tracked;
  }
  return applyRules(
    replaceTracked(tracked, SPACE_BEFORE_NO, '$1'),
    NO_AFTER_DIGIT_RULES,
  );
};

/**
 * 番地・番・号の表記をハイフンの形にする（AddressNumbersToHyphen）
 *
 * @param tracked - 対象
 * @returns 変えた結果。変わらなければ同じ文字列
 */
export const addressNumbersToHyphen = (tracked: TrackedText): TrackedText => {
  const original = tracked.text;
  if (!HAS_ASCII_DIGIT.test(original)) {
    return tracked;
  }
  const hasMarker = ADDRESS_MARKERS.some((marker) => original.includes(marker));
  const hasFloor = DIGIT_BEFORE_F.test(original);
  if (!hasMarker && !hasFloor) {
    return tracked;
  }
  const plainBan = !hasBanGoPattern(original) && !hasBanTouPattern(original);

  let result = tracked;
  if (ROOM_OR_FLOOR.test(result.text)) {
    result = applyRules(result, ROOM_FLOOR_RULES);
  }
  if (result.text.includes('番地')) {
    const illegal = applyFirstMatch(result, ILLEGAL_BANCHI_RULES);
    if (illegal !== undefined) {
      return illegal;
    }
  }
  if (result.text.includes('番')) {
    result = processBanchi(result);
    if (result.text.includes('番町')) {
      result = applyRules(result, BANCHO_RULES);
    }
    result = processBan(result, plainBan);
  }
  result = processNoPatterns(result);
  if (result.text.includes('号') || result.text.includes('番町')) {
    result = applyRules(result, GO_AND_POSTFIX_RULES);
  }
  return result;
};

/**
 * 最初の「数字-数字」の並びの後ろに空白を入れる（addSpaceAfterFirstArabicNumber）
 *
 * 直後が街区・丁目・番地などなら入れない。
 *
 * @param tracked - 対象
 * @returns 変えた結果。変わらなければ同じ文字列
 */
export const addSpaceAfterFirstArabicNumber = (
  tracked: TrackedText,
): TrackedText => {
  const match = FIRST_ARABIC.exec(tracked.text);
  if (match === null) {
    return tracked;
  }
  const end = match.index + match[0].length;
  const after = tracked.text.slice(end);
  if (NO_SPACE_COMPONENTS.some((component) => after.startsWith(component))) {
    return tracked;
  }
  if (end < tracked.text.length && tracked.text.charAt(end) !== ' ') {
    return insertTracked(tracked, end, ' ');
  }
  return tracked;
};

const isNoParticleBlock = (after: string): boolean => {
  const first = after.charAt(0);
  if (first !== 'の' && first !== 'ノ') {
    return false;
  }
  return after.length === 1 || isAsciiDigit(after.charAt(1));
};

const isKanjiDigitChome = (after: string): boolean => {
  const first = after.codePointAt(0) ?? 0;
  if (first < 0x4e00 || first > 0x9fff) {
    return false;
  }
  return isAsciiDigit(after.charAt(1)) && after.includes('丁目');
};

const sameAddressToken = (after: string): boolean =>
  ADDRESS_COMPONENTS.some((component) => after.startsWith(component)) ||
  isNoParticleBlock(after) ||
  isKanjiDigitChome(after);

/**
 * 数字の直後の日本語の前に空白を入れる（addSpaceAfterNumberBeforeJapanese）
 *
 * 前から順に入れ、住所の続き（丁目・番地など）に当たったところで止める。
 *
 * @param tracked - 対象
 * @returns 変えた結果。変わらなければ同じ文字列
 */
export const addSpaceAfterNumberBeforeJapanese = (
  tracked: TrackedText,
): TrackedText => {
  let result = tracked;
  for (;;) {
    const match = NUMBER_BEFORE_JAPANESE.exec(result.text);
    const japanese = match?.indices?.[2];
    if (match === null || japanese === undefined) {
      return result;
    }
    if (sameAddressToken(result.text.slice(japanese[0]))) {
      return result;
    }
    result = insertTracked(result, japanese[0], ' ');
  }
};

/**
 * 住所の型に応じて番号の表記を整える（applyAddressFormatting）
 *
 * @param tracked - 対象
 * @param addressType - 住所の型
 * @returns 整えた結果
 */
export const applyAddressFormatting = (
  tracked: TrackedText,
  addressType: AddressType,
): TrackedText => {
  switch (addressType) {
    case 'undetermined':
    case 'unknown': {
      const hyphenated = addressNumbersToHyphen(tracked);
      if (hyphenated.text !== tracked.text) {
        return hyphenated;
      }
      const spaced = addSpaceAfterFirstArabicNumber(tracked);
      if (spaced.text !== tracked.text) {
        return spaced;
      }
      if (addressType === 'unknown') {
        return addSpaceAfterNumberBeforeJapanese(tracked);
      }
      return tracked;
    }
    case 'rsdtdsp':
    case 'parcel':
      return addressNumbersToHyphen(tracked);
  }
};

/**
 * 括弧と読点の前に空白を入れ、閉じ括弧の後ろに空白を入れる（addSpacesAroundPunctuation）
 *
 * 続いた半角の空白は1つにし、末尾の半角の空白を落とす。
 *
 * @param tracked - 対象
 * @returns 変えた結果。変わらなければ同じ文字列
 */
export const addSpacesAroundPunctuation = (
  tracked: TrackedText,
): TrackedText => {
  if (!PUNCTUATION.test(tracked.text)) {
    return tracked;
  }
  const parts: TrackedText[] = [];
  let previousSpace = true;
  for (let i = 0; i < tracked.text.length; i++) {
    const char = tracked.text.charAt(i);
    const self = sliceTracked(tracked, i, i + 1);
    switch (char) {
      case '(':
      case ',':
      case '、':
        if (!previousSpace) {
          parts.push(insertedText(' '));
        }
        parts.push(self);
        previousSpace = false;
        break;
      case ')':
        parts.push(self, insertedText(' '));
        previousSpace = true;
        break;
      case ' ':
        if (!previousSpace) {
          parts.push(self);
          previousSpace = true;
        }
        break;
      default:
        parts.push(self);
        previousSpace = false;
        break;
    }
  }
  return trimTracked(concatTracked(...parts), (char) => char === ' ', false);
};

/**
 * BasicNormalize をかけた住所を整える（NormalizeBasicNormalized）
 *
 * 最初の括弧から後ろを切り離し、住所の型を判定して番号の表記を整え、括弧を戻して句読点の前後に空白を入れる。
 *
 * @param tracked - basicNormalize をかけた住所
 * @returns 整えた住所と住所の型
 */
export const normalizeBasicNormalized = (
  tracked: TrackedText,
): FormattedAddress => {
  const parenthesis = tracked.text.indexOf('(');
  let address =
    parenthesis < 0 ? tracked : sliceTracked(tracked, 0, parenthesis);
  const addressType = detectAddressType(address.text);
  address = normalizeSpaces(applyAddressFormatting(address, addressType));
  if (parenthesis >= 0) {
    address = concatTracked(
      trimSpace(address),
      insertedText(' '),
      sliceTracked(tracked, parenthesis),
    );
  }
  return {
    text: trimSpace(addSpacesAroundPunctuation(address)),
    addressType,
  };
};

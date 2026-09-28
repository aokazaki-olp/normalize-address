/**
 * trackedText.ts
 *
 * @description 各文字が元のテキストのどの位置から来たかを保ったまま、文字列を置き換える
 */

/** 文字列と、各 UTF-16 コード単位の元のテキストでの位置（挿入した字は -1） */
export interface TrackedText {
  readonly text: string;
  readonly origins: readonly number[];
}

const GROUP_REFERENCE = /\$(\d)/gu;

/**
 * 元のテキストそのものを TrackedText にする
 *
 * @param text - 元のテキスト
 * @returns 各字の位置が自分の位置である TrackedText
 */
export const trackText = (text: string): TrackedText => ({
  text,
  origins: Array.from({ length: text.length }, (_, i) => i),
});

/**
 * 挿入する字を TrackedText にする
 *
 * @param text - 挿入する字
 * @returns 各字の位置が -1 の TrackedText
 */
export const insertedText = (text: string): TrackedText => ({
  text,
  origins: Array.from({ length: text.length }, () => -1),
});

/**
 * TrackedText の一部を取り出す
 *
 * @param tracked - 対象
 * @param start - 開始位置
 * @param end - 終了位置（省略すると末尾まで）
 * @returns 取り出した TrackedText
 */
export const sliceTracked = (
  tracked: TrackedText,
  start: number,
  end?: number,
): TrackedText => ({
  text: tracked.text.slice(start, end),
  origins: tracked.origins.slice(start, end),
});

/**
 * 配列で渡した TrackedText をつなぐ
 *
 * @param parts - つなぐもの（入力の長さに比例して増えるものはこちらで渡す）
 * @returns つないだ TrackedText
 */
export const joinTracked = (parts: readonly TrackedText[]): TrackedText => ({
  text: parts.map((part) => part.text).join(''),
  origins: parts.flatMap((part) => part.origins),
});

/**
 * TrackedText をつなぐ
 *
 * @param parts - つなぐもの
 * @returns つないだ TrackedText
 */
export const concatTracked = (...parts: TrackedText[]): TrackedText =>
  joinTracked(parts);

const expandTemplate = (
  tracked: TrackedText,
  indices: RegExpIndicesArray,
  template: string,
): TrackedText[] => {
  const parts: TrackedText[] = [];
  let last = 0;
  for (const reference of template.matchAll(GROUP_REFERENCE)) {
    parts.push(insertedText(template.slice(last, reference.index)));
    const span = indices[Number(reference[1])];
    if (span !== undefined) {
      parts.push(sliceTracked(tracked, span[0], span[1]));
    }
    last = reference.index + reference[0].length;
  }
  parts.push(insertedText(template.slice(last)));
  return parts;
};

/**
 * 正規表現に当たる部分をすべて置き換える
 *
 * テンプレートの $1〜$9 はグループに当たった部分（当たらなかったグループは空）で、元の位置を保つ。
 * それ以外の字は挿入した字として扱う。
 *
 * @param tracked - 対象
 * @param pattern - g と d のフラグを持つ正規表現
 * @param template - 置き換えるテンプレート
 * @returns 置き換えた TrackedText
 */
export const replaceTracked = (
  tracked: TrackedText,
  pattern: RegExp,
  template: string,
): TrackedText => {
  const parts: TrackedText[] = [];
  let last = 0;
  for (const match of tracked.text.matchAll(pattern)) {
    const indices = match.indices;
    if (indices === undefined) {
      throw new TypeError('pattern には d のフラグを指定してください');
    }
    parts.push(sliceTracked(tracked, last, match.index));
    parts.push(...expandTemplate(tracked, indices, template));
    last = match.index + match[0].length;
  }
  if (parts.length === 0) {
    return tracked;
  }
  parts.push(sliceTracked(tracked, last));
  return joinTracked(parts);
};

/**
 * 指定した位置に字を挿入する
 *
 * @param tracked - 対象
 * @param position - 挿入する位置
 * @param text - 挿入する字
 * @returns 挿入した TrackedText
 */
export const insertTracked = (
  tracked: TrackedText,
  position: number,
  text: string,
): TrackedText =>
  concatTracked(
    sliceTracked(tracked, 0, position),
    insertedText(text),
    sliceTracked(tracked, position),
  );

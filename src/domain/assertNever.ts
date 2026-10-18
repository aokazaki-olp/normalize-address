/**
 * assertNever.ts
 *
 * @description 型で閉じた switch の網羅を、型と実行時の両方で確かめる
 */

/**
 * 型で閉じた値の switch の default で呼び、ケースの漏れを型エラーにする（規約 §5.2）
 *
 * @param value - どのケースにも当たらなかった値（型の上では never）
 * @returns 返らない
 * @throws {Error} 呼ばれた場合（型を越えた値が来たとき）
 */
export const assertNever = (value: never): never => {
  throw new Error(`想定していない値: ${String(value)}`);
};

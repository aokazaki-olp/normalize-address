/**
 * checkedHttp.ts
 *
 * @description NJA の取得処理に、応答のステータスの検査をかぶせる
 */

import { NormalizeAddressError } from './normalizeAddressError.ts';

/** NJA が取得処理に渡す範囲指定 */
export interface RangeOptions {
  offset?: number;
  length?: number;
}

/** 検査に使う応答の部分 */
export interface HttpResponse {
  readonly status: number;
  readonly body: { cancel(): Promise<void> } | null;
}

export type HttpHandler<T extends HttpResponse> = (
  url: URL,
  options?: RangeOptions,
) => Promise<T>;

const PARTIAL_CONTENT = 206;

const isExpectedStatus = (status: number, ranged: boolean): boolean =>
  ranged ? status === PARTIAL_CONTENT : status >= 200 && status < 300;

/**
 * 取得処理を、応答のステータスを検査するものに包む
 *
 * 範囲指定の取得で 206 以外、それ以外の取得で 2xx 以外なら NormalizeAddressError を投げる。
 * 元の取得処理が例外を投げたときも、それを cause に入れた NormalizeAddressError にする。
 *
 * @param handler - 元の取得処理
 * @returns 検査をかぶせた取得処理
 * @throws {NormalizeAddressError} 取得に失敗した場合
 */
export const createCheckedHttp =
  <T extends HttpResponse>(handler: HttpHandler<T>): HttpHandler<T> =>
  async (url, options) => {
    // 元の取得処理は URL に API キーを書き足すので、その前の URL をエラーに入れる
    const target = url.toString();
    let response: T;
    try {
      response = await handler(url, options);
    } catch (error) {
      throw new NormalizeAddressError(
        `住所データの取得に失敗しました: ${target}`,
        target,
        undefined,
        { cause: error },
      );
    }
    const ranged =
      options?.offset !== undefined && options.length !== undefined;
    if (isExpectedStatus(response.status, ranged)) {
      return response;
    }
    await response.body?.cancel();
    throw new NormalizeAddressError(
      `住所データの取得に失敗しました（${String(response.status)}）: ${target}`,
      target,
      response.status,
    );
  };

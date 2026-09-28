/**
 * normalizeAddressError.ts
 *
 * @description 正規化器が処理を終えられなかったことを表すエラー
 */

/**
 * 正規化器が入力の誤り以外の理由で処理を終えられなかったことを表す
 *
 * 住所データの取得の失敗（2xx 以外、範囲指定の取得で 206 以外、取得処理そのものの例外）と、
 * NJA が想定外の level を返したときに投げる。入力の誤りは TypeError で、これには含めない。
 *
 * その入力をあとで再試行する価値がある失敗である。ただし NJA の想定外の level は、再試行しても同じ結果になる。
 *
 * 判定は `instanceof` ではなく `error.name === 'NormalizeAddressError'` で行える。
 * `instanceof` は realm を跨ぐと誤判定し、このクラスが別の複製として読み込まれたときも一致しない。
 */
export class NormalizeAddressError extends Error {
  override readonly name = 'NormalizeAddressError';
  /** 取得の失敗のとき、取得した URL（API キーを書き足す前）。それ以外は undefined */
  readonly url: string | undefined;
  /** HTTP の応答があったときのステータス。それ以外は undefined */
  readonly status: number | undefined;

  /**
   * @param message - エラーの説明
   * @param url - 取得した URL。取得の失敗でなければ undefined
   * @param status - 応答のステータス。応答が無ければ undefined
   * @param options - 元の例外（cause）
   */
  constructor(
    message: string,
    url: string | undefined,
    status: number | undefined,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.url = url;
    this.status = status;
  }
}

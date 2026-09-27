/**
 * addressDataError.ts
 *
 * @description 住所データの取得の失敗を表すエラー
 */

/** 住所データの取得に失敗したことを表す */
export class AddressDataError extends Error {
  override readonly name = 'AddressDataError';
  /** 取得した URL */
  readonly url: string;
  /** 応答のステータス */
  readonly status: number;

  /**
   * @param message - エラーの説明
   * @param url - 取得した URL
   * @param status - 応答のステータス
   * @param options - cause など
   */
  constructor(
    message: string,
    url: string,
    status: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.url = url;
    this.status = status;
  }
}

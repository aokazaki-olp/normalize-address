/**
 * njaParser.ts
 *
 * @description NJA を使う AddressParser の実装
 */

import {
  normalize,
  requestHandlers,
  type NormalizeResult,
} from '@geolonia/normalize-japanese-addresses';
import type { AddressParser, ParsedAddress } from '../ports/addressParser.ts';
import type { AddressLevel } from '../ports/addressResult.ts';
import { createCheckedHttp } from './checkedHttp.ts';
import { NormalizeAddressError } from './normalizeAddressError.ts';

const LEVELS: readonly AddressLevel[] = [0, 1, 2, 3, 8];
const LG_CODE_LENGTH = 6;

const toLevel = (level: number): AddressLevel => {
  const found = LEVELS.find((candidate) => candidate === level);
  if (found === undefined) {
    throw new NormalizeAddressError(
      `NJA が想定外の level を返しました: ${String(level)}`,
      undefined,
      undefined,
    );
  }
  return found;
};

/**
 * NJA の結果を ParsedAddress にする
 *
 * 市区町村コードは数値で先頭のゼロが落ちているので、6桁にそろえる。NJA が返さなかった項目は null にする。
 *
 * @param result - NJA の結果
 * @returns 解析の結果
 * @throws {NormalizeAddressError} level が 0・1・2・3・8 のどれでもない場合
 */
export const toParsedAddress = (result: NormalizeResult): ParsedAddress => {
  const cityCode = result.metadata.city?.code;
  const machiazaId = result.metadata.machiAza?.machiaza_id;
  return {
    prefecture: result.pref ?? null,
    city: result.city ?? null,
    town: result.town ?? null,
    block: result.addr ?? null,
    unmatched: result.other,
    level: toLevel(result.level),
    point:
      result.point === undefined
        ? null
        : {
            lat: result.point.lat,
            lng: result.point.lng,
            level: result.point.level,
          },
    lgCode:
      cityCode === undefined
        ? null
        : String(cityCode).padStart(LG_CODE_LENGTH, '0'),
    machiazaId: machiazaId ?? null,
    raw: result,
  };
};

/**
 * NJA の normalize が投げた例外を NormalizeAddressError にそろえる
 *
 * NJA は応答の本文を取得処理の外で読むので、本文の読み取りの失敗などは取得処理の検査では包めない（docs/design.md の「失敗の扱い」）。
 *
 * @param error - NJA の normalize が投げた値
 * @returns name が NormalizeAddressError の Error はそのまま、それ以外は元の値を cause に入れた NormalizeAddressError
 */
export const toNormalizeAddressError = (error: unknown): Error =>
  Error.isError(error) && error.name === 'NormalizeAddressError'
    ? error
    : new NormalizeAddressError(
        'NJA の処理に失敗しました',
        undefined,
        undefined,
        { cause: error },
      );

let checkedHttpInstalled = false;

// requestHandlers はモジュール全体で1つなので、差し替えは1回だけ行う
const installCheckedHttp = (): void => {
  if (checkedHttpInstalled) {
    return;
  }
  requestHandlers.http = createCheckedHttp(requestHandlers.http);
  checkedHttpInstalled = true;
};

/**
 * NJA を使う AddressParser を作る
 *
 * 最初の解析の前に、NJA の取得処理（requestHandlers.http）を応答のステータスを検査するものに差し替える。
 * NJA の normalize が投げた例外は NormalizeAddressError にそろえる。
 *
 * @returns AddressParser
 */
export const createNjaParser = (): AddressParser => ({
  parse: async (text) => {
    installCheckedHttp();
    let result: NormalizeResult;
    try {
      result = await normalize(text);
    } catch (error) {
      throw toNormalizeAddressError(error);
    }
    return toParsedAddress(result);
  },
});

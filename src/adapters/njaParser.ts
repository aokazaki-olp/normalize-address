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
 *
 * @returns AddressParser
 */
export const createNjaParser = (): AddressParser => ({
  parse: async (text) => {
    installCheckedHttp();
    return toParsedAddress(await normalize(text));
  },
});

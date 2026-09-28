import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { NormalizeResult } from '@geolonia/normalize-japanese-addresses';

import { toParsedAddress } from '../../src/adapters/njaParser.ts';
import { NormalizeAddressError } from '../../src/adapters/normalizeAddressError.ts';

const SAPPORO = {
  pref: '北海道',
  city: '札幌市中央区',
  town: '北一条西二丁目',
  addr: '1',
  other: '',
  level: 8,
  point: { lat: 43.06, lng: 141.35, level: 8 },
  metadata: {
    input: '北海道札幌市中央区北1条西2丁目1',
    city: { code: 11011, city: '札幌市', ward: '中央区' },
    machiAza: { machiaza_id: '0001002' },
  },
} as unknown as NormalizeResult;

describe('toParsedAddress', () => {
  it('NJA の結果を ParsedAddress にする', () => {
    assert.deepEqual(toParsedAddress(SAPPORO), {
      prefecture: '北海道',
      city: '札幌市中央区',
      town: '北一条西二丁目',
      block: '1',
      unmatched: '',
      level: 8,
      point: { lat: 43.06, lng: 141.35, level: 8 },
      lgCode: '011011',
      machiazaId: '0001002',
      raw: SAPPORO,
    });
  });

  it('市区町村コードを6桁にそろえる', () => {
    const result = {
      ...SAPPORO,
      metadata: { input: '', city: { code: 131130 } },
    } as unknown as NormalizeResult;
    assert.equal(toParsedAddress(result).lgCode, '131130');
  });

  it('無い項目は null にする', () => {
    const result = {
      other: '住所ではない',
      level: 0,
      metadata: { input: '住所ではない' },
    } as unknown as NormalizeResult;
    assert.deepEqual(toParsedAddress(result), {
      prefecture: null,
      city: null,
      town: null,
      block: null,
      unmatched: '住所ではない',
      level: 0,
      point: null,
      lgCode: null,
      machiazaId: null,
      raw: result,
    });
  });

  for (const level of [4, 7, 9, -1, 3.5]) {
    it(`level ${String(level)} は NormalizeAddressError`, () => {
      assert.throws(
        () => toParsedAddress({ ...SAPPORO, level }),
        (error) => {
          assert.ok(error instanceof NormalizeAddressError);
          assert.equal(error.name, 'NormalizeAddressError');
          assert.equal(error.url, undefined);
          assert.equal(error.status, undefined);
          assert.equal(error.cause, undefined);
          return true;
        },
      );
    });
  }
});

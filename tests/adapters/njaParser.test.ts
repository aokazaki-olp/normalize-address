import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  config,
  requestHandlers,
  type NormalizeResult,
} from '@geolonia/normalize-japanese-addresses';

import {
  createNjaParser,
  toNormalizeAddressError,
  toParsedAddress,
} from '../../src/adapters/njaParser.ts';
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

  it('raw は NJA の結果の写し', () => {
    const raw = toParsedAddress(SAPPORO).raw;
    assert.notEqual(raw, SAPPORO);
    assert.deepEqual(raw, SAPPORO);
    const metadata = raw['metadata'] as { city: { city: string } };
    metadata.city.city = '書き換え';
    assert.equal(
      (SAPPORO.metadata.city as unknown as { city: string }).city,
      '札幌市',
    );
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

describe('toNormalizeAddressError', () => {
  const originals: [string, unknown][] = [
    ['TypeError', new TypeError('terminated')],
    ['SyntaxError', new SyntaxError('Unexpected token <')],
    ['Error', new Error('Unknown URL schema: ftp:')],
    ['Error でない値', 'failure'],
  ];
  for (const [name, original] of originals) {
    it(`${name} は cause に入れた NormalizeAddressError にする`, () => {
      const error = toNormalizeAddressError(original);
      assert.ok(error instanceof NormalizeAddressError);
      assert.equal(error.name, 'NormalizeAddressError');
      assert.equal(error.url, undefined);
      assert.equal(error.status, undefined);
      assert.equal(error.cause, original);
    });
  }

  it('NormalizeAddressError はそのまま返す', () => {
    const original = new NormalizeAddressError('取得の失敗', 'https://x', 500);
    assert.equal(toNormalizeAddressError(original), original);
  });

  it('name が NormalizeAddressError の Error は別の複製でもそのまま返す', () => {
    const original = Object.assign(new Error('別の複製'), {
      name: 'NormalizeAddressError',
    });
    assert.equal(toNormalizeAddressError(original), original);
  });
});

describe('createNjaParser（偽の取得処理）', () => {
  let respond: () => Promise<Response> = async () => new Response('');
  requestHandlers.http = (async () =>
    respond()) as unknown as typeof requestHandlers.http;
  const parser = createNjaParser();

  const assertWrapped = async (check: (cause: unknown) => void) => {
    await assert.rejects(parser.parse('東京都千代田区'), (error) => {
      assert.ok(Error.isError(error));
      assert.equal(error.name, 'NormalizeAddressError');
      check(error.cause);
      return true;
    });
  };

  it('2xx で本文が JSON でなければ NormalizeAddressError（cause は SyntaxError）', async () => {
    respond = async () => new Response('<html></html>', { status: 200 });
    await assertWrapped((cause) => {
      assert.ok(cause instanceof SyntaxError);
    });
  });

  it('都道府県の一覧の取得が 503 なら NormalizeAddressError（status は 503）', async () => {
    respond = async () => new Response('', { status: 503 });
    await assert.rejects(parser.parse('東京都千代田区'), (error) => {
      assert.ok(Error.isError(error));
      assert.equal(error.name, 'NormalizeAddressError');
      assert.equal('status' in error ? error.status : undefined, 503);
      return true;
    });
  });

  it('本文の途中で切れたら NormalizeAddressError（cause は元の例外）', async () => {
    const terminated = new TypeError('terminated');
    respond = async () =>
      new Response(
        new ReadableStream({
          start: (controller) => {
            controller.enqueue(new TextEncoder().encode('{"meta":'));
            controller.error(terminated);
          },
        }),
        { status: 200 },
      );
    await assertWrapped((cause) => {
      assert.equal(cause, terminated);
    });
  });

  it('未知のスキームなら NormalizeAddressError（cause は Error）', async () => {
    const api = config.japaneseAddressesApi;
    config.japaneseAddressesApi = 'ftp://example.invalid/ja';
    try {
      await assertWrapped((cause) => {
        assert.ok(Error.isError(cause));
        assert.match(cause.message, /Unknown URL schema/u);
      });
    } finally {
      config.japaneseAddressesApi = api;
    }
  });

  it('file:// の取得先が無ければ NormalizeAddressError（cause は ENOENT）', async () => {
    const api = config.japaneseAddressesApi;
    config.japaneseAddressesApi = 'file:///nonexistent-normalize-address/ja';
    try {
      await assertWrapped((cause) => {
        assert.ok(Error.isError(cause));
        assert.equal('code' in cause ? cause.code : undefined, 'ENOENT');
      });
    } finally {
      config.japaneseAddressesApi = api;
    }
  });

  // NJA は形の違う JSON でも都道府県の一覧をキャッシュするので、この検査を最後に置く
  it('形の違う JSON なら NormalizeAddressError（cause は TypeError）', async () => {
    respond = async () => new Response('{}', { status: 200 });
    await assertWrapped((cause) => {
      assert.ok(cause instanceof TypeError);
    });
  });
});

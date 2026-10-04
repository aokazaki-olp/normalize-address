import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createCheckedHttp,
  type HttpResponse,
  type RangeOptions,
} from '../../src/adapters/checkedHttp.ts';
import { NormalizeAddressError } from '../../src/adapters/normalizeAddressError.ts';

const fakeHandler = (status: number) => {
  const cancelled: boolean[] = [];
  const handler = async (
    url: URL,
    _options?: RangeOptions,
  ): Promise<HttpResponse> => {
    url.search = '?geolonia-api-key=secret';
    return {
      status,
      body: {
        cancel: async () => {
          cancelled.push(true);
        },
      },
    };
  };
  return { handler, cancelled };
};

const URL_TEXT = 'https://example.com/api/ja/東京都/渋谷区-住居表示.txt';
const RANGE = { offset: 10, length: 20 };

describe('createCheckedHttp', () => {
  const passes: [string, number, RangeOptions | undefined][] = [
    ['範囲指定なしの 200', 200, undefined],
    ['範囲指定なしの 299', 299, {}],
    ['範囲指定の 206', 206, RANGE],
    ['offset だけなら範囲指定ではない', 200, { offset: 1 }],
  ];
  for (const [name, status, options] of passes) {
    it(`${name} は通す`, async () => {
      const { handler } = fakeHandler(status);
      const response = await createCheckedHttp(handler)(
        new URL(URL_TEXT),
        options,
      );
      assert.equal(response.status, status);
    });
  }

  const fails: [string, number, RangeOptions | undefined][] = [
    ['範囲指定なしの 404', 404, undefined],
    ['範囲指定なしの 199', 199, undefined],
    ['範囲指定なしの 300', 300, undefined],
    ['範囲指定の 200', 200, RANGE],
    ['範囲指定の 416', 416, RANGE],
    ['範囲指定の 0 バイト目からの 500', 500, { offset: 0, length: 1 }],
  ];
  for (const [name, status, options] of fails) {
    it(`${name} は NormalizeAddressError`, async () => {
      const { handler, cancelled } = fakeHandler(status);
      const url = new URL(URL_TEXT);
      await assert.rejects(
        createCheckedHttp(handler)(url, options),
        (error) => {
          assert.ok(error instanceof NormalizeAddressError);
          assert.equal(error.name, 'NormalizeAddressError');
          assert.equal(error.status, status);
          assert.equal(error.url, new URL(URL_TEXT).toString());
          assert.equal(error.message.includes('secret'), false);
          assert.equal(error.cause, undefined);
          return true;
        },
      );
      assert.deepEqual(cancelled, [true]);
    });
  }

  it('本文が無い応答でも NormalizeAddressError', async () => {
    const handler = async (): Promise<HttpResponse> => ({
      status: 500,
      body: null,
    });
    await assert.rejects(
      createCheckedHttp(handler)(new URL(URL_TEXT)),
      NormalizeAddressError,
    );
  });

  it('取得処理の例外は cause に入れた NormalizeAddressError にする', async () => {
    const failure = new TypeError('fetch failed');
    const handler = async (url: URL): Promise<HttpResponse> => {
      url.search = '?geolonia-api-key=secret';
      throw failure;
    };
    await assert.rejects(
      createCheckedHttp(handler)(new URL(URL_TEXT), RANGE),
      (error) => {
        assert.ok(error instanceof NormalizeAddressError);
        assert.equal(error.name, 'NormalizeAddressError');
        assert.equal(error.status, undefined);
        assert.equal(error.url, new URL(URL_TEXT).toString());
        assert.equal(error.message.includes('secret'), false);
        assert.equal(error.cause, failure);
        return true;
      },
    );
  });

  it('Error でない値が投げられても cause に残す', async () => {
    const handler = async (): Promise<HttpResponse> => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- Error でない値を投げる取得処理を再現する
      throw 'network down';
    };
    await assert.rejects(
      createCheckedHttp(handler)(new URL(URL_TEXT)),
      (error) => {
        assert.ok(error instanceof NormalizeAddressError);
        assert.equal(error.cause, 'network down');
        return true;
      },
    );
  });
});

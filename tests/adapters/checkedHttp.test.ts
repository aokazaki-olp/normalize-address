import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AddressDataError } from '../../src/adapters/addressDataError.ts';
import {
  createCheckedHttp,
  type HttpResponse,
  type RangeOptions,
} from '../../src/adapters/checkedHttp.ts';

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
    it(`${name} は AddressDataError`, async () => {
      const { handler, cancelled } = fakeHandler(status);
      const url = new URL(URL_TEXT);
      await assert.rejects(
        createCheckedHttp(handler)(url, options),
        (error) => {
          assert.ok(error instanceof AddressDataError);
          assert.equal(error.name, 'AddressDataError');
          assert.equal(error.status, status);
          assert.equal(error.url, new URL(URL_TEXT).toString());
          assert.equal(error.message.includes('secret'), false);
          return true;
        },
      );
      assert.deepEqual(cancelled, [true]);
    });
  }

  it('本文が無い応答でも AddressDataError', async () => {
    const handler = async (): Promise<HttpResponse> => ({
      status: 500,
      body: null,
    });
    await assert.rejects(
      createCheckedHttp(handler)(new URL(URL_TEXT)),
      AddressDataError,
    );
  });

  it('取得処理の例外はそのまま伝える', async () => {
    const failure = new TypeError('fetch failed');
    const handler = async (): Promise<HttpResponse> => {
      throw failure;
    };
    await assert.rejects(
      createCheckedHttp(handler)(new URL(URL_TEXT)),
      failure,
    );
  });
});

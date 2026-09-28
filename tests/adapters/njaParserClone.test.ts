import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { requestHandlers } from '@geolonia/normalize-japanese-addresses';

import { createNjaParser } from '../../src/adapters/njaParser.ts';

// NJA のモジュールの状態（キャッシュ・取得処理の差し替え）を njaParser.test.ts と別のプロセスで分けるため、ファイルを分ける

// 名前とコードは公開の情報、座標と町字 ID は作った値
const PREFECTURES = {
  meta: { updated: 1 },
  data: [
    {
      code: 13000,
      pref: '東京都',
      pref_k: 'トウキョウト',
      pref_r: 'Tokyo',
      point: [139.69, 35.68],
      cities: [
        {
          code: 13101,
          city: '千代田区',
          city_k: 'チヨダク',
          city_r: 'Chiyoda-ku',
          point: [139.75, 35.69],
        },
      ],
    },
  ],
};
const TOWNS = {
  meta: { updated: 1 },
  data: [
    {
      machiaza_id: '0000001',
      oaza_cho: '丸の内',
      chome: '一丁目',
      chome_n: 1,
      point: [139.76, 35.68],
    },
  ],
};
const FILES: Record<string, unknown> = {
  '/api/ja.json': PREFECTURES,
  '/api/ja/東京都/千代田区.json': TOWNS,
};

describe('createNjaParser（NJA の実物と固定データ）', () => {
  requestHandlers.http = (async (url: URL) => {
    const body = FILES[decodeURIComponent(url.pathname)];
    return body === undefined
      ? new Response('', { status: 404 })
      : new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof requestHandlers.http;
  const parser = createNjaParser();

  it('raw を書き換えても、NJA のキャッシュと以後の結果は変わらない', async () => {
    const first = await parser.parse('東京都千代田区丸の内一丁目');
    assert.equal(first.town, '丸の内一丁目');
    const metadata = first.raw['metadata'] as { city: { city: string } };
    metadata.city.city = '書き換え';
    const second = await parser.parse('東京都千代田区丸の内一丁目');
    assert.equal(second.city, '千代田区');
    assert.equal(
      (second.raw['metadata'] as { city: { city: string } }).city.city,
      '千代田区',
    );
    assert.notEqual(second.raw, first.raw);
  });
});

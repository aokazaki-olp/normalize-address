import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createNormalizeAddress } from '../../src/application/normalizeAddress.ts';
import type {
  AddressParser,
  ParsedAddress,
} from '../../src/ports/addressParser.ts';

const SHIBUYA = { prefecture: '東京都', city: '渋谷区', town: '道玄坂一丁目' };

const createFakeParser = (
  results: Record<string, Partial<ParsedAddress>>,
): AddressParser & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    parse: async (text) => {
      calls.push(text);
      const result = results[text];
      return result === undefined
        ? { other: text, level: 0, raw: { text } }
        : { other: '', level: 0, raw: { text }, ...result };
    },
  };
};

describe('normalizeAddress', () => {
  it('入力にガード付き NFKC をかけてから解析する', async () => {
    const parser = createFakeParser({});
    const normalize = createNormalizeAddress(parser);
    await normalize('ﾆｾｺ１');
    assert.deepEqual(parser.calls, ['ニセコ1']);
  });

  it('level 3 未満なら切れ目を探さない', async () => {
    const parser = createFakeParser({
      東京都渋谷区1ビル: {
        prefecture: '東京都',
        city: '渋谷区',
        other: '1ビル',
        level: 2,
      },
    });
    const result = await createNormalizeAddress(parser)('東京都渋谷区1ビル');
    assert.equal(result.split, 'skipped');
    assert.equal(result.building, '');
    assert.equal(result.other, '1ビル');
    assert.equal(parser.calls.length, 1);
  });

  it('level 8 で残りが無ければ none', async () => {
    const parser = createFakeParser({
      '東京都渋谷区道玄坂1-2-3': {
        ...SHIBUYA,
        number: '2-3',
        other: '',
        level: 8,
      },
    });
    const result =
      await createNormalizeAddress(parser)('東京都渋谷区道玄坂1-2-3');
    assert.equal(result.split, 'none');
    assert.equal(result.building, '');
    assert.equal(parser.calls.length, 1);
  });

  it('level 3 で番地らしい部分のあとに残りが無ければ none', async () => {
    const parser = createFakeParser({
      '東京都渋谷区道玄坂1-9-9': { ...SHIBUYA, other: '9-9', level: 3 },
    });
    const result =
      await createNormalizeAddress(parser)('東京都渋谷区道玄坂1-9-9');
    assert.equal(result.split, 'none');
    assert.equal(result.other, '9-9');
  });

  it('前半が全体と一致した最初の位置で切る（level 8）', async () => {
    const parser = createFakeParser({
      '東京都渋谷区道玄坂1-2-3 タワー12F': {
        ...SHIBUYA,
        number: '2-3',
        other: ' タワ-12F',
        level: 8,
        point: { lat: 35, lng: 139, level: 8 },
      },
      東京都渋谷区道玄坂1: { ...SHIBUYA, level: 3 },
      '東京都渋谷区道玄坂1-2': { ...SHIBUYA, number: '2', level: 8 },
      '東京都渋谷区道玄坂1-2-3': { ...SHIBUYA, number: '2-3', level: 8 },
    });
    const result = await createNormalizeAddress(parser)(
      '東京都渋谷区道玄坂1-2-3 タワー１２Ｆ',
    );
    assert.deepEqual(result, {
      input: '東京都渋谷区道玄坂1-2-3 タワー１２Ｆ',
      ...SHIBUYA,
      number: '2-3',
      building: 'タワー12F',
      other: '',
      level: 8,
      point: { lat: 35, lng: 139, level: 8 },
      split: 'found',
    });
    assert.deepEqual(parser.calls, [
      '東京都渋谷区道玄坂1-2-3 タワー12F',
      '東京都渋谷区道玄坂1',
      '東京都渋谷区道玄坂1-2',
      '東京都渋谷区道玄坂1-2-3',
    ]);
  });

  it('前半が全体と一致した最初の位置で切る（level 3）', async () => {
    const parser = createFakeParser({
      '京都府京都市X町12-3 ビル': {
        prefecture: '京都府',
        city: '京都市',
        town: 'X町',
        other: '12-3 ビル',
        level: 3,
      },
      京都府京都市X町12: {
        prefecture: '京都府',
        city: '京都市',
        town: 'X町',
        other: '12',
        level: 3,
      },
      '京都府京都市X町12-3': {
        prefecture: '京都府',
        city: '京都市',
        town: 'X町',
        other: '12-3',
        level: 3,
      },
    });
    const result =
      await createNormalizeAddress(parser)('京都府京都市X町12-3 ビル');
    assert.equal(result.split, 'found');
    assert.equal(result.building, 'ビル');
    assert.equal(result.other, '12-3');
    assert.equal(result.number, undefined);
  });

  it('号の直後で切り、数字の直後の番・号では切らない', async () => {
    const parser = createFakeParser({
      東京都渋谷区道玄坂一丁目28番9号2階: {
        ...SHIBUYA,
        other: '28-9号2階',
        level: 3,
      },
      東京都渋谷区道玄坂一丁目28番9号: {
        ...SHIBUYA,
        other: '28-9号',
        level: 3,
      },
    });
    const result = await createNormalizeAddress(parser)(
      '東京都渋谷区道玄坂一丁目28番9号2階',
    );
    assert.equal(result.split, 'found');
    assert.equal(result.building, '2階');
    assert.equal(result.other, '28-9号');
    assert.deepEqual(parser.calls, [
      '東京都渋谷区道玄坂一丁目28番9号2階',
      '東京都渋谷区道玄坂一',
      '東京都渋谷区道玄坂一丁目28番9号',
    ]);
  });

  it('住所の末尾の直後が号だけなら none', async () => {
    const parser = createFakeParser({
      '東京都渋谷区道玄坂一丁目5番15-2号': {
        ...SHIBUYA,
        other: '5-15-2号',
        level: 3,
      },
    });
    const result = await createNormalizeAddress(parser)(
      '東京都渋谷区道玄坂一丁目5番15-2号',
    );
    assert.equal(result.split, 'none');
    assert.equal(result.building, '');
    assert.equal(result.other, '5-15-2号');
    assert.equal(parser.calls.length, 1);
  });

  it('building の先頭のハイフンを落とす', async () => {
    const parser = createFakeParser({
      '東京都渋谷区道玄坂1-20-B1F': { ...SHIBUYA, other: '20-B1F', level: 3 },
      東京都渋谷区道玄坂1: { ...SHIBUYA, level: 3 },
      '東京都渋谷区道玄坂1-20': { ...SHIBUYA, other: '20', level: 3 },
    });
    const result =
      await createNormalizeAddress(parser)('東京都渋谷区道玄坂1-20-B1F');
    assert.equal(result.split, 'found');
    assert.equal(result.building, 'B1F');
    assert.equal(result.other, '20');
  });

  it('ハイフンを落として building が空なら none', async () => {
    const parser = createFakeParser({
      '東京都渋谷区道玄坂1-20-': { ...SHIBUYA, other: '20-', level: 3 },
      '東京都渋谷区道玄坂1-20': { ...SHIBUYA, other: '20', level: 3 },
    });
    const result =
      await createNormalizeAddress(parser)('東京都渋谷区道玄坂1-20-');
    assert.equal(result.split, 'none');
    assert.equal(result.building, '');
    assert.equal(result.other, '20-');
  });

  it('一致する位置が無ければ unresolved', async () => {
    const parser = createFakeParser({
      '東京都渋谷区道玄坂1-2-3ビル': {
        ...SHIBUYA,
        number: '2-3',
        other: 'ビル',
        level: 8,
      },
    });
    const result =
      await createNormalizeAddress(parser)('東京都渋谷区道玄坂1-2-3ビル');
    assert.equal(result.split, 'unresolved');
    assert.equal(result.building, '');
    assert.equal(result.other, 'ビル');
    assert.equal(parser.calls.length, 4);
  });

  it('オプションを結果に反映する', async () => {
    const parser = createFakeParser({
      '東京都渋谷区道玄坂1-2-3': {
        ...SHIBUYA,
        number: '2-3',
        other: '',
        level: 8,
        lgCode: '131130',
      },
    });
    const result = await createNormalizeAddress(parser)(
      '東京都渋谷区道玄坂1-2-3',
      {
        codes: true,
        nja: true,
        style: { fields: { number: { digit: 'full' } } },
      },
    );
    assert.equal(result.number, '２-３');
    assert.deepEqual(result.codes, { lgCode: '131130' });
    assert.deepEqual(result.nja, { text: '東京都渋谷区道玄坂1-2-3' });
  });

  it('input が文字列でなければ TypeError で、解析しない', async () => {
    const parser = createFakeParser({});
    const normalize = createNormalizeAddress(parser);
    const inputs: unknown[] = [undefined, null, 1, {}];
    for (const input of inputs) {
      await assert.rejects(normalize(input as string), TypeError);
    }
    assert.equal(parser.calls.length, 0);
  });

  it('解析の失敗はそのまま伝える', async () => {
    const failure = new Error('取得の失敗');
    const normalize = createNormalizeAddress({
      parse: async () => {
        throw failure;
      },
    });
    await assert.rejects(normalize('東京都'), failure);
  });
});

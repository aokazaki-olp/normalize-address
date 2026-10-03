import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { CharStyle } from '@arihirookazaki/normalize-core';

import { createAddressNormalizer } from '../../src/application/addressNormalizer.ts';
import type {
  AddressParser,
  ParsedAddress,
} from '../../src/ports/addressParser.ts';
import type { AddressResult } from '../../src/ports/addressResult.ts';
import { NJA_RECORDED_CASES } from './njaRecordedCases.ts';

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
      const empty = {
        prefecture: null,
        city: null,
        town: null,
        block: null,
        unmatched: result === undefined ? text : '',
        level: 0,
        point: null,
        lgCode: null,
        machiazaId: null,
        raw: { text },
      } satisfies ParsedAddress;
      return Object.assign(empty, result);
    },
  };
};

describe('createAddressNormalizer', () => {
  it('入力にガード付き NFKC をかけてから解析する', async () => {
    const parser = createFakeParser({});
    const normalizer = createAddressNormalizer(parser);
    await normalizer.normalize('ﾆｾｺ１');
    assert.deepEqual(parser.calls, ['ニセコ1']);
  });

  it('level 3 未満なら切れ目を探さない', async () => {
    const parser = createFakeParser({
      東京都渋谷区1ビル: {
        prefecture: '東京都',
        city: '渋谷区',
        unmatched: '1ビル',
        level: 2,
      },
    });
    const result =
      await createAddressNormalizer(parser).normalize('東京都渋谷区1ビル');
    assert.equal(result.split, 'skipped');
    assert.equal(result.building, '');
    assert.equal(result.unmatched, '1ビル');
    assert.equal(parser.calls.length, 1);
  });

  it('level 8 で残りが無ければ none', async () => {
    const parser = createFakeParser({
      '東京都渋谷区道玄坂1-2-3': {
        ...SHIBUYA,
        block: '2-3',
        unmatched: '',
        level: 8,
      },
    });
    const result =
      await createAddressNormalizer(parser).normalize(
        '東京都渋谷区道玄坂1-2-3',
      );
    assert.equal(result.split, 'none');
    assert.equal(result.building, '');
    assert.equal(parser.calls.length, 1);
  });

  it('level 3 で番地らしい部分のあとに残りが無ければ none', async () => {
    const parser = createFakeParser({
      '東京都渋谷区道玄坂1-9-9': { ...SHIBUYA, unmatched: '9-9', level: 3 },
    });
    const result =
      await createAddressNormalizer(parser).normalize(
        '東京都渋谷区道玄坂1-9-9',
      );
    assert.equal(result.split, 'none');
    assert.equal(result.unmatched, '9-9');
  });

  it('建物部の始まりの位置で切り、住所の項目は前半の結果から取る（level 8）', async () => {
    const parser = createFakeParser({
      '東京都渋谷区道玄坂1-2-3 タワー12F': {
        ...SHIBUYA,
        block: '2-3',
        unmatched: ' タワ-12F',
        level: 8,
        point: { lat: 35, lng: 139, level: 8 },
      },
      '東京都渋谷区道玄坂1-2-3': {
        ...SHIBUYA,
        block: '2-3',
        level: 8,
        point: { lat: 35.5, lng: 139.5, level: 8 },
      },
    });
    const result = await createAddressNormalizer(parser).normalize(
      '東京都渋谷区道玄坂1-2-3 タワー１２Ｆ',
    );
    assert.deepEqual(result, {
      input: '東京都渋谷区道玄坂1-2-3 タワー１２Ｆ',
      ...SHIBUYA,
      block: '2-3',
      building: 'タワー12F',
      unmatched: '',
      level: 8,
      point: { lat: 35.5, lng: 139.5, level: 8 },
      split: 'found',
    });
    assert.deepEqual(parser.calls, [
      '東京都渋谷区道玄坂1-2-3 タワー12F',
      '東京都渋谷区道玄坂1-2-3',
    ]);
  });

  it('建物部の始まりの位置の前半が使えなければ、切れ目の候補を前から試す', async () => {
    const parser = createFakeParser({
      '東京都渋谷区道玄坂1丁目 28番地ビル': {
        ...SHIBUYA,
        unmatched: '28ビル',
        level: 3,
      },
      東京都渋谷区道玄坂1丁目: { ...SHIBUYA, level: 3 },
      '東京都渋谷区道玄坂1丁目 28番地': {
        ...SHIBUYA,
        unmatched: '28',
        level: 3,
      },
    });
    const result = await createAddressNormalizer(parser).normalize(
      '東京都渋谷区道玄坂1丁目 28番地ビル',
    );
    assert.equal(result.split, 'found');
    assert.equal(result.building, 'ビル');
    assert.equal(result.unmatched, '28');
    assert.deepEqual(parser.calls, [
      '東京都渋谷区道玄坂1丁目 28番地ビル',
      '東京都渋谷区道玄坂1丁目',
      '東京都渋谷区道玄坂1',
      '東京都渋谷区道玄坂1丁目',
      '東京都渋谷区道玄坂1丁目 28番地',
    ]);
  });

  it('前半が全体と一致した最初の位置で切る（level 3）', async () => {
    const parser = createFakeParser({
      '京都府京都市X町12-3 ビル': {
        prefecture: '京都府',
        city: '京都市',
        town: 'X町',
        unmatched: '12-3 ビル',
        level: 3,
      },
      京都府京都市X町12: {
        prefecture: '京都府',
        city: '京都市',
        town: 'X町',
        unmatched: '12',
        level: 3,
      },
      '京都府京都市X町12-3': {
        prefecture: '京都府',
        city: '京都市',
        town: 'X町',
        unmatched: '12-3',
        level: 3,
      },
    });
    const result =
      await createAddressNormalizer(parser).normalize(
        '京都府京都市X町12-3 ビル',
      );
    assert.equal(result.split, 'found');
    assert.equal(result.building, 'ビル');
    assert.equal(result.unmatched, '12-3');
    assert.equal(result.block, null);
  });

  it('号の直後で切る', async () => {
    const parser = createFakeParser({
      東京都渋谷区道玄坂一丁目28番9号2階: {
        ...SHIBUYA,
        unmatched: '28-9号2階',
        level: 3,
      },
      東京都渋谷区道玄坂一丁目28番9号: {
        ...SHIBUYA,
        unmatched: '28-9号',
        level: 3,
      },
    });
    const result = await createAddressNormalizer(parser).normalize(
      '東京都渋谷区道玄坂一丁目28番9号2階',
    );
    assert.equal(result.split, 'found');
    assert.equal(result.building, '2階');
    assert.equal(result.unmatched, '28-9号');
    assert.deepEqual(parser.calls, [
      '東京都渋谷区道玄坂一丁目28番9号2階',
      '東京都渋谷区道玄坂一丁目28番9号',
    ]);
  });

  it('住所の末尾の直後が号だけなら none', async () => {
    const parser = createFakeParser({
      '東京都渋谷区道玄坂一丁目5番15-2号': {
        ...SHIBUYA,
        unmatched: '5-15-2号',
        level: 3,
      },
    });
    const result = await createAddressNormalizer(parser).normalize(
      '東京都渋谷区道玄坂一丁目5番15-2号',
    );
    assert.equal(result.split, 'none');
    assert.equal(result.building, '');
    assert.equal(result.unmatched, '5-15-2号');
    assert.equal(parser.calls.length, 1);
  });

  it('building の先頭のハイフンを落とす', async () => {
    const parser = createFakeParser({
      '東京都渋谷区道玄坂1-20-B1F': {
        ...SHIBUYA,
        unmatched: '20-B1F',
        level: 3,
      },
      東京都渋谷区道玄坂1: { ...SHIBUYA, level: 3 },
      '東京都渋谷区道玄坂1-20': { ...SHIBUYA, unmatched: '20', level: 3 },
    });
    const result =
      await createAddressNormalizer(parser).normalize(
        '東京都渋谷区道玄坂1-20-B1F',
      );
    assert.equal(result.split, 'found');
    assert.equal(result.building, 'B1F');
    assert.equal(result.unmatched, '20');
  });

  it('ハイフンを落として building が空なら none', async () => {
    const parser = createFakeParser({
      '東京都渋谷区道玄坂1-20-': { ...SHIBUYA, unmatched: '20-', level: 3 },
      '東京都渋谷区道玄坂1-20': { ...SHIBUYA, unmatched: '20', level: 3 },
    });
    const result =
      await createAddressNormalizer(parser).normalize(
        '東京都渋谷区道玄坂1-20-',
      );
    assert.equal(result.split, 'none');
    assert.equal(result.building, '');
    assert.equal(result.unmatched, '20-');
  });

  it('一致する位置が無ければ unresolved', async () => {
    const parser = createFakeParser({
      '東京都渋谷区道玄坂1-2-3ビル': {
        ...SHIBUYA,
        block: '2-3',
        unmatched: 'ビル',
        level: 8,
      },
    });
    const result =
      await createAddressNormalizer(parser).normalize(
        '東京都渋谷区道玄坂1-2-3ビル',
      );
    assert.equal(result.split, 'unresolved');
    assert.equal(result.building, '');
    assert.equal(result.unmatched, 'ビル');
    assert.deepEqual(parser.calls, [
      '東京都渋谷区道玄坂1-2-3ビル',
      '東京都渋谷区道玄坂1-2-3',
      '東京都渋谷区道玄坂1',
      '東京都渋谷区道玄坂1-2',
      '東京都渋谷区道玄坂1-2-3',
    ]);
  });

  it('オプションを結果に反映する', async () => {
    const parser = createFakeParser({
      '東京都渋谷区道玄坂1-2-3': {
        ...SHIBUYA,
        block: '2-3',
        unmatched: '',
        level: 8,
        lgCode: '131130',
      },
    });
    const result = await createAddressNormalizer(parser, {
      codes: true,
      nja: true,
      style: { fields: { block: { digit: 'full' } } },
    }).normalize('東京都渋谷区道玄坂1-2-3');
    assert.equal(result.block, '２-３');
    assert.deepEqual(result.codes, { lgCode: '131130', machiazaId: null });
    assert.deepEqual(result.nja, { text: '東京都渋谷区道玄坂1-2-3' });
  });

  it('input が文字列でなければ TypeError で、解析しない', async () => {
    const parser = createFakeParser({});
    const normalizer = createAddressNormalizer(parser);
    const inputs: unknown[] = [undefined, null, 1, {}];
    for (const input of inputs) {
      await assert.rejects(normalizer.normalize(input as string), TypeError);
    }
    assert.equal(parser.calls.length, 0);
  });

  it('字形の指定が検査を満たさなければ、作るときに TypeError で、解析しない', () => {
    const parser = createFakeParser({ 東京都: { prefecture: '東京都' } });
    assert.throws(
      () =>
        createAddressNormalizer(parser, {
          style: { default: { chars: { ab: 'x' } } },
        }),
      TypeError,
    );
    assert.equal(parser.calls.length, 0);
  });

  it('同じ正規化器で何回も正規化できる', async () => {
    const parser = createFakeParser({
      '東京都渋谷区道玄坂1-2-3': {
        ...SHIBUYA,
        block: '2-3',
        level: 8,
      },
      '東京都渋谷区道玄坂1-2-4': {
        ...SHIBUYA,
        block: '2-4',
        level: 8,
      },
    });
    const normalizer = createAddressNormalizer(parser, {
      style: { fields: { block: { digit: 'full' } } },
    });
    const first = await normalizer.normalize('東京都渋谷区道玄坂1-2-3');
    const second = await normalizer.normalize('東京都渋谷区道玄坂1-2-4');
    const again = await normalizer.normalize('東京都渋谷区道玄坂1-2-3');
    assert.equal(first.block, '２-３');
    assert.equal(second.block, '２-４');
    assert.deepEqual(again, first);
  });

  it('作ったあとで options を書き換えても効かない', async () => {
    const parser = createFakeParser({
      '東京都渋谷区道玄坂1-2-3': { ...SHIBUYA, block: '2-3', level: 8 },
    });
    const charStyle: CharStyle = { digit: 'full' };
    const options = { codes: false, style: { default: charStyle } };
    const normalizer = createAddressNormalizer(parser, options);
    options.codes = true;
    charStyle.digit = 'half';
    const result = await normalizer.normalize('東京都渋谷区道玄坂1-2-3');
    assert.equal(result.block, '２-３');
    assert.equal('codes' in result, false);
  });

  it('建物部が長くても RangeError にならない', async () => {
    const building = 'ビ'.repeat(200000);
    const parser = createFakeParser({
      [`東京都渋谷区道玄坂一丁目2番3号 ${building}`]: {
        ...SHIBUYA,
        block: '2-3',
        unmatched: ` ${building}`,
        level: 8,
      },
      東京都渋谷区道玄坂一丁目2番3号: { ...SHIBUYA, block: '2-3', level: 8 },
    });
    const result = await createAddressNormalizer(parser).normalize(
      `東京都渋谷区道玄坂一丁目2番3号 ${building}`,
    );
    assert.equal(result.split, 'found');
    assert.equal(result.building, building);
  });

  it('建物部の始まりの位置の1つ目の候補を受け入れなければ、2つ目の候補で切る', async () => {
    const parser = createFakeParser({
      '東京都渋谷区道玄坂1-2-3-405号室 ゾゾ荘': {
        ...SHIBUYA,
        block: '2-3',
        unmatched: '-405号室 ゾゾ荘',
        level: 8,
      },
      '東京都渋谷区道玄坂1-2-3-405号室': {
        prefecture: '東京都',
        city: '渋谷区',
        unmatched: '道玄坂1-2-3-405号室',
        level: 2,
      },
      '東京都渋谷区道玄坂1-2-3': { ...SHIBUYA, block: '2-3', level: 8 },
    });
    const result = await createAddressNormalizer(parser).normalize(
      '東京都渋谷区道玄坂1-2-3-405号室 ゾゾ荘',
    );
    assert.equal(result.split, 'found');
    assert.equal(result.block, '2-3');
    assert.equal(result.building, '405号室 ゾゾ荘');
    assert.deepEqual(parser.calls, [
      '東京都渋谷区道玄坂1-2-3-405号室 ゾゾ荘',
      '東京都渋谷区道玄坂1-2-3-405号室',
      '東京都渋谷区道玄坂1-2-3',
    ]);
  });

  it('建物部の始まりの位置の1つ目の候補の建物部が空なら、2つ目の候補で切る', async () => {
    const parser = createFakeParser({
      '東京都渋谷区道玄坂1-2-3-405号室 -': {
        ...SHIBUYA,
        block: '2-3',
        unmatched: '-405号室 -',
        level: 8,
      },
      '東京都渋谷区道玄坂1-2-3': { ...SHIBUYA, block: '2-3', level: 8 },
    });
    const result = await createAddressNormalizer(parser).normalize(
      '東京都渋谷区道玄坂1-2-3-405号室 -',
    );
    assert.equal(result.split, 'found');
    assert.equal(result.building, '405号室 -');
    assert.deepEqual(parser.calls, [
      '東京都渋谷区道玄坂1-2-3-405号室 -',
      '東京都渋谷区道玄坂1-2-3',
    ]);
  });

  it('空文字の入力は level 0・skipped で、例外にしない', async () => {
    const parser = createFakeParser({});
    const result = await createAddressNormalizer(parser).normalize('');
    assert.equal(result.level, 0);
    assert.equal(result.split, 'skipped');
    assert.equal(result.building, '');
    assert.equal(result.unmatched, '');
  });

  it('切れ目の候補で切ったときは、住所の項目と level を全体の結果から取る', async () => {
    const parser = createFakeParser({
      '東京都渋谷区道玄坂1-2-3ビル': {
        ...SHIBUYA,
        block: '2-3',
        unmatched: 'ビル',
        level: 8,
      },
      '東京都渋谷区道玄坂1-2-3': { ...SHIBUYA, unmatched: '2-3', level: 3 },
    });
    const result =
      await createAddressNormalizer(parser).normalize(
        '東京都渋谷区道玄坂1-2-3ビル',
      );
    assert.equal(result.split, 'found');
    assert.equal(result.block, '2-3');
    assert.equal(result.level, 8);
    assert.equal(result.unmatched, '2-3');
    assert.equal(result.building, 'ビル');
    assert.deepEqual(parser.calls, [
      '東京都渋谷区道玄坂1-2-3ビル',
      '東京都渋谷区道玄坂1-2-3',
      '東京都渋谷区道玄坂1',
      '東京都渋谷区道玄坂1-2',
      '東京都渋谷区道玄坂1-2-3',
    ]);
  });

  it('解析の失敗はそのまま伝える', async () => {
    const failure = new Error('取得の失敗');
    const normalizer = createAddressNormalizer({
      parse: async () => {
        throw failure;
      },
    });
    await assert.rejects(normalizer.normalize('東京都'), failure);
  });
});

describe('createAddressNormalizer（偽の parser が NJA 3.1.3 の実際の値を返す例）', () => {
  for (const { name, input, results, expected } of NJA_RECORDED_CASES) {
    it(name, async () => {
      const parser = createFakeParser(results);
      const result = await createAddressNormalizer(parser).normalize(input);
      const actual = Object.fromEntries(
        Object.keys(expected).map((key) => [
          key,
          result[key as keyof AddressResult],
        ]),
      );
      assert.deepEqual(actual, expected);
      for (const text of parser.calls) {
        assert.ok(text in results, `偽の parser に無い入力：${text}`);
      }
      for (const text of Object.keys(results)) {
        assert.ok(
          parser.calls.includes(text),
          `偽の parser の表にあるのに解析されなかった入力：${text}`,
        );
      }
    });
  }
});

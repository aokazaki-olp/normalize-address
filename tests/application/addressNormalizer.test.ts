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
  it('手順6で切った建物部が数字の無い階の印で始まれば、切らずに unresolved にする', async () => {
    const area = { prefecture: '架空県', city: '架空市', town: '架空町' };
    const parser = createFakeParser({
      架空県架空市架空町32F: {
        ...area,
        block: '32',
        unmatched: 'F',
        level: 8,
      },
      架空県架空市架空町32: { ...area, block: '32', level: 8 },
    });
    const normalizer = createAddressNormalizer(parser);
    const result = await normalizer.normalize('架空県架空市架空町32F');
    assert.equal(result.split, 'unresolved');
    assert.equal(result.building, '');
    assert.equal(result.unmatched, 'F');
    assert.equal(result.block, '32');
  });
  it('都道府県の無い入力が同じ名前の市で始まれば、候補ごとに解析して良いほうを採る', async () => {
    const parser = createFakeParser({
      東京都府中市府中町一丁目12番地の7: {
        prefecture: '東京都',
        city: '府中市',
        town: '府中町一丁目',
        unmatched: '12-7',
        level: 3,
      },
      広島県府中市府中町一丁目12番地の7: {
        prefecture: '広島県',
        city: '府中市',
        town: '府中町',
        unmatched: '一丁目12-7',
        level: 3,
      },
    });
    const normalizer = createAddressNormalizer(parser);
    const result = await normalizer.normalize('府中市府中町一丁目12番地の7');
    assert.equal(result.prefecture, '東京都');
    assert.equal(result.town, '府中町一丁目');
    assert.equal(result.input, '府中市府中町一丁目12番地の7');
  });

  it('都道府県の候補が同点なら、都道府県を付けずに解析する', async () => {
    const parser = createFakeParser({
      府中市1: { prefecture: '東京都', city: '府中市', level: 2 },
    });
    const normalizer = createAddressNormalizer(parser);
    const result = await normalizer.normalize('府中市1');
    assert.deepEqual(parser.calls, [
      '東京都府中市1',
      '広島県府中市1',
      '府中市1',
    ]);
    assert.equal(result.prefecture, '東京都');
  });
  it('入力にガード付き NFKC をかけてから解析する', async () => {
    const parser = createFakeParser({});
    const normalizer = createAddressNormalizer(parser);
    await normalizer.normalize('ﾆｾｺ１');
    assert.deepEqual(parser.calls, ['ニセコ1']);
  });

  it('全体が level 3 で、上限までの番号の前半が level 8 なら、住所の項目を前半から取る', async () => {
    const kioicho = {
      prefecture: '東京都',
      city: '千代田区',
      town: '紀尾井町',
    };
    const parser = createFakeParser({
      '東京都千代田区紀尾井町1-3-101': {
        ...kioicho,
        unmatched: '1-3-101',
        level: 3,
      },
      '東京都千代田区紀尾井町1-3': {
        ...kioicho,
        block: '1-3',
        level: 8,
      },
    });
    const result =
      await createAddressNormalizer(parser).normalize(
        '東京都千代田区紀尾井町1-3-101',
      );
    assert.equal(result.block, '1-3');
    assert.equal(result.level, 8);
    assert.equal(result.unmatched, '');
    assert.equal(result.building, '101');
    assert.equal(result.split, 'found');
  });

  it('3つ目の番号が の でつながるなら、3桁以上でも住所に残して none にする', async () => {
    const parser = createFakeParser({
      東京都渋谷区道玄坂12の345番地の678: {
        ...SHIBUYA,
        unmatched: '12-345-678',
        level: 3,
      },
    });
    const result = await createAddressNormalizer(parser).normalize(
      '東京都渋谷区道玄坂12の345番地の678',
    );
    assert.equal(result.split, 'none');
    assert.equal(result.unmatched, '12-345-678');
    assert.equal(result.building, '');
  });

  it('3つ目の3桁以上の番号が横棒でつながるなら、建物部にする', async () => {
    const parser = createFakeParser({
      '東京都渋谷区道玄坂12-345-678': {
        ...SHIBUYA,
        unmatched: '12-345-678',
        level: 3,
      },
      東京都渋谷区道玄坂12: { ...SHIBUYA, unmatched: '12', level: 3 },
      '東京都渋谷区道玄坂12-345': {
        ...SHIBUYA,
        unmatched: '12-345',
        level: 3,
      },
    });
    const result = await createAddressNormalizer(parser).normalize(
      '東京都渋谷区道玄坂12-345-678',
    );
    assert.equal(result.split, 'found');
    assert.equal(result.unmatched, '12-345');
    assert.equal(result.building, '678');
  });

  it('漢数字で書いた3つ目の番号も の でつながるなら住所に残して none にする', async () => {
    const parser = createFakeParser({
      東京都渋谷区道玄坂三百四十の十二の五百: {
        ...SHIBUYA,
        unmatched: '340-12-500',
        level: 3,
      },
    });
    const result = await createAddressNormalizer(parser).normalize(
      '東京都渋谷区道玄坂三百四十の十二の五百',
    );
    assert.equal(result.split, 'none');
    assert.equal(result.unmatched, '340-12-500');
    assert.equal(result.building, '');
  });

  it('部屋番号の列挙は住所の続きとみなさず建物部にする', async () => {
    const parser = createFakeParser({
      '東京都渋谷区道玄坂1-2-3 101・102号': {
        ...SHIBUYA,
        block: '2-3',
        unmatched: ' 101・102号',
        level: 8,
      },
      '東京都渋谷区道玄坂1-2-3': { ...SHIBUYA, block: '2-3', level: 8 },
    });
    const result = await createAddressNormalizer(parser).normalize(
      '東京都渋谷区道玄坂1-2-3 101・102号',
    );
    assert.equal(result.split, 'found');
    assert.equal(result.building, '101・102号');
  });

  it('最後の1字が 0 なら、1桁を階に回さず、残りの階は unmatched に残す', async () => {
    const parser = createFakeParser({
      東京都渋谷区道玄坂14010階: {
        ...SHIBUYA,
        unmatched: '14010階',
        level: 3,
      },
      東京都渋谷区道玄坂14010: { ...SHIBUYA, unmatched: '14010', level: 3 },
      東京都渋谷区道玄坂1401: { ...SHIBUYA, block: '1401', level: 8 },
    });
    const result =
      await createAddressNormalizer(parser).normalize(
        '東京都渋谷区道玄坂14010階',
      );
    assert.equal(result.split, 'unresolved');
    assert.equal(result.unmatched, '14010階');
    assert.equal(result.building, '');
  });

  it('空白のあとの階の数字だけを建物部にし、支号は住所に残す', async () => {
    const parser = createFakeParser({
      '東京都渋谷区道玄坂87番地13 4F': {
        ...SHIBUYA,
        unmatched: '87-134F',
        level: 3,
      },
      東京都渋谷区道玄坂87番地13: { ...SHIBUYA, unmatched: '87-13', level: 3 },
    });
    const result =
      await createAddressNormalizer(parser).normalize(
        '東京都渋谷区道玄坂87番地13 4F',
      );
    assert.equal(result.split, 'found');
    assert.equal(result.unmatched, '87-13');
    assert.equal(result.building, '4F');
  });

  it('全体の住所の末尾が空で、後ろが地番の列挙だけなら none にする', async () => {
    const parser = createFakeParser({
      '東京都渋谷区道玄坂字北野245番3、245番4': {
        ...SHIBUYA,
        unmatched: '字北野245-3、245-4',
        level: 3,
      },
      東京都渋谷区道玄坂字北野245番3: {
        ...SHIBUYA,
        unmatched: '字北野245-3',
        level: 3,
      },
    });
    const result = await createAddressNormalizer(parser).normalize(
      '東京都渋谷区道玄坂字北野245番3、245番4',
    );
    assert.equal(result.split, 'none');
    assert.equal(result.building, '');
  });

  it('全体の住所の末尾が空で、後ろが住所の続きでなければ unresolved のまま', async () => {
    const parser = createFakeParser({
      東京都渋谷区道玄坂字北野245番3ゾゾ荘: {
        ...SHIBUYA,
        unmatched: '字北野245-3ゾゾ荘',
        level: 3,
      },
    });
    const result = await createAddressNormalizer(parser).normalize(
      '東京都渋谷区道玄坂字北野245番3ゾゾ荘',
    );
    assert.equal(result.split, 'unresolved');
  });

  it('N番地のあとの第N は枝番として住所に残し、none にする', async () => {
    const parser = createFakeParser({
      東京都渋谷区道玄坂甲12番地第3: {
        ...SHIBUYA,
        unmatched: '甲12番地第3',
        level: 3,
      },
      東京都渋谷区道玄坂甲12番地: { ...SHIBUYA, unmatched: '甲12', level: 3 },
    });
    const result =
      await createAddressNormalizer(parser).normalize(
        '東京都渋谷区道玄坂甲12番地第3',
      );
    assert.equal(result.split, 'none');
    assert.equal(result.building, '');
  });

  it('長い番号の並びの入力でも短い時間で返す', async () => {
    const tail = `、${'1'.repeat(3000)}あ`;
    const parser = createFakeParser({
      [`東京都渋谷区道玄坂1-2-3${tail}`]: {
        ...SHIBUYA,
        block: '2-3',
        unmatched: tail,
        level: 8,
      },
      '東京都渋谷区道玄坂1-2-3': { ...SHIBUYA, block: '2-3', level: 8 },
    });
    const start = performance.now();
    const result = await createAddressNormalizer(parser).normalize(
      `東京都渋谷区道玄坂1-2-3${tail}`,
    );
    assert.ok(performance.now() - start < 500);
    assert.equal(result.split, 'found');
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
    const inputs: any[] = [undefined, null, 1, {}];
    for (const input of inputs) {
      await assert.rejects(normalizer.normalize(input), TypeError);
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
  const RESULT_KEYS: readonly (keyof AddressResult)[] = [
    'input',
    'prefecture',
    'city',
    'town',
    'block',
    'building',
    'unmatched',
    'level',
    'point',
    'split',
    'codes',
    'nja',
  ];
  for (const { name, input, results, expected } of NJA_RECORDED_CASES) {
    it(name, async () => {
      const parser = createFakeParser(results);
      const result = await createAddressNormalizer(parser).normalize(input);
      const actual = Object.fromEntries(
        RESULT_KEYS.filter((key) => key in expected).map((key) => [
          key,
          result[key],
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

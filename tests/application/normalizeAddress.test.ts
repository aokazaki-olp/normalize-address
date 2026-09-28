import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createNormalizeAddress } from '../../src/application/normalizeAddress.ts';
import type {
  AddressParser,
  ParsedAddress,
} from '../../src/ports/addressParser.ts';
import type { AddressResult } from '../../src/ports/addressResult.ts';

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

  it('建物部の始まりの位置で切り、住所の項目は前半の結果から取る（level 8）', async () => {
    const parser = createFakeParser({
      '東京都渋谷区道玄坂1-2-3 タワー12F': {
        ...SHIBUYA,
        number: '2-3',
        other: ' タワ-12F',
        level: 8,
        point: { lat: 35, lng: 139, level: 8 },
      },
      '東京都渋谷区道玄坂1-2-3': {
        ...SHIBUYA,
        number: '2-3',
        level: 8,
        point: { lat: 35.5, lng: 139.5, level: 8 },
      },
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
        other: '28ビル',
        level: 3,
      },
      東京都渋谷区道玄坂1丁目: { ...SHIBUYA, level: 3 },
      '東京都渋谷区道玄坂1丁目 28番地': {
        ...SHIBUYA,
        other: '28',
        level: 3,
      },
    });
    const result = await createNormalizeAddress(parser)(
      '東京都渋谷区道玄坂1丁目 28番地ビル',
    );
    assert.equal(result.split, 'found');
    assert.equal(result.building, 'ビル');
    assert.equal(result.other, '28');
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

  it('号の直後で切る', async () => {
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

describe('normalizeAddress（偽の parser が NJA 3.1.3 の実際の値を返す例）', () => {
  const SAPPORO = {
    prefecture: '北海道',
    city: '札幌市中央区',
    town: '南三条西三丁目',
  };
  const INAGI = { prefecture: '東京都', city: '稲城市', town: '向陽台六丁目' };
  const KIYOKAWA = {
    prefecture: '福岡県',
    city: '福岡市中央区',
    town: '清川二丁目',
  };
  const DAISEN = {
    prefecture: '秋田県',
    city: '大仙市',
    town: '大曲須和町二丁目',
  };
  const NIBANCHO = { prefecture: '東京都', city: '千代田区', town: '二番町' };
  const KIOICHO = { prefecture: '東京都', city: '千代田区', town: '紀尾井町' };
  const CHAYAMADAI = {
    prefecture: '大阪府',
    city: '堺市南区',
    town: '茶山台一丁',
  };
  const GINZA = { prefecture: '東京都', city: '中央区', town: '銀座二丁目' };
  const AKASHI = {
    prefecture: '兵庫県',
    city: '明石市',
    town: '大久保町ゆりのき通二丁目',
  };
  const KAMATA = { prefecture: '東京都', city: '大田区', town: '蒲田五丁目' };
  const HIGASHISUNA = {
    prefecture: '東京都',
    city: '江東区',
    town: '東砂二丁目',
  };
  const ROKUBANCHO = { prefecture: '東京都', city: '千代田区', town: '六番町' };
  const USUKI = { prefecture: '大分県', city: '臼杵市', town: '大字臼杵' };
  const TANMACHI = {
    prefecture: '神奈川県',
    city: '横浜市神奈川区',
    town: '反町三丁目',
  };
  const YOTSUYA = { prefecture: '東京都', city: '新宿区', town: '四谷三丁目' };
  const KITAICHIJO = {
    prefecture: '北海道',
    city: '札幌市中央区',
    town: '北一条西五丁目',
  };
  const TOGA = { prefecture: '大阪府', city: '堺市南区', town: '栂' };
  const HAKATA = {
    prefecture: '福岡県',
    city: '福岡市博多区',
    town: '博多駅南一丁目',
  };
  const IWASE = { prefecture: '千葉県', city: '松戸市', town: '岩瀬' };
  const MINAMINAKADORI = {
    prefecture: '神奈川県',
    city: '横浜市中区',
    town: '南仲通三丁目',
  };
  const YAGUSU = { prefecture: '静岡県', city: '焼津市', town: '八楠一丁目' };
  const WAKABAYASHI = {
    prefecture: '宮城県',
    city: '仙台市若林区',
    town: '六丁目字南',
  };
  const OMACHI = { prefecture: '富山県', city: '富山市', town: '大町' };

  const cases: [
    string,
    string,
    Record<string, Partial<ParsedAddress>>,
    Partial<AddressResult>,
  ][] = [
    [
      'A：建物名の先頭の漢数字を番地に読まれても、前半の結果を使う',
      '札幌市中央区南3条西3丁目10番地三信ビル4階',
      {
        札幌市中央区南3条西3丁目10番地三信ビル4階: {
          ...SAPPORO,
          other: '10-3信ビル4階',
          level: 3,
        },
        札幌市中央区南3条西3丁目10番地: {
          ...SAPPORO,
          other: '10',
          level: 3,
        },
      },
      { level: 3, other: '10', building: '三信ビル4階', split: 'found' },
    ],
    [
      'B：空白の後ろの階の数字を番地につなげない',
      '稲城市向陽台六丁目2番地1 1階',
      {
        '稲城市向陽台六丁目2番地1 1階': {
          ...INAGI,
          other: '2-11階',
          level: 3,
        },
        稲城市向陽台六丁目2番地1: { ...INAGI, other: '2-1', level: 3 },
      },
      { level: 3, other: '2-1', building: '1階', split: 'found' },
    ],
    [
      'C：ハイフンでつないだ番号の最後の号室を建物部にする',
      '福岡県福岡市中央区清川2-12-4-102号室',
      {
        '福岡県福岡市中央区清川2-12-4-102号室': {
          ...KIYOKAWA,
          other: '12-4-102号室',
          level: 3,
        },
        '福岡県福岡市中央区清川2-12-4': {
          ...KIYOKAWA,
          number: '12-4',
          level: 8,
        },
      },
      {
        number: '12-4',
        level: 8,
        other: '',
        building: '102号室',
        split: 'found',
      },
    ],
    [
      'D：level 8 で other に号だけが残れば none',
      '秋田県大仙市大曲須和町二丁目3番21―5号',
      {
        '秋田県大仙市大曲須和町二丁目3番21―5号': {
          ...DAISEN,
          number: '3-21-5',
          other: '号',
          level: 8,
        },
      },
      {
        number: '3-21-5',
        level: 8,
        other: '号',
        building: '',
        split: 'none',
      },
    ],
    [
      '空白の後ろの番町で始まる建物名',
      '東京都千代田区二番町1-2 番町ハイム209号',
      {
        '東京都千代田区二番町1-2 番町ハイム209号': {
          ...NIBANCHO,
          number: '1-2',
          other: '番町ハイム209号',
          level: 8,
        },
        '東京都千代田区二番町1-2': { ...NIBANCHO, number: '1-2', level: 8 },
      },
      {
        number: '1-2',
        level: 8,
        other: '',
        building: '番町ハイム209号',
        split: 'found',
      },
    ],
    [
      '号の直後の番町で始まる建物名',
      '東京都千代田区紀尾井町1番3号番町YMビル',
      {
        東京都千代田区紀尾井町1番3号番町YMビル: {
          ...KIOICHO,
          number: '1-3',
          other: ' 番町YMビル',
          level: 8,
        },
        東京都千代田区紀尾井町1番3号: {
          ...KIOICHO,
          number: '1-3',
          level: 8,
        },
      },
      {
        number: '1-3',
        level: 8,
        other: '',
        building: '番町YMビル',
        split: 'found',
      },
    ],
    [
      '号の直後の地下で始まる建物部',
      '東京都千代田区紀尾井町1番9号地下1階',
      {
        東京都千代田区紀尾井町1番9号地下1階: {
          ...KIOICHO,
          number: '1-9',
          other: ' 地下1階',
          level: 8,
        },
        東京都千代田区紀尾井町1番9号: {
          ...KIOICHO,
          number: '1-9',
          level: 8,
        },
      },
      {
        number: '1-9',
        level: 8,
        other: '',
        building: '地下1階',
        split: 'found',
      },
    ],
    [
      '番地の直後の建物名（level 3）',
      '大阪府堺市南区茶山台1丁270番地泉北ビル2階',
      {
        大阪府堺市南区茶山台1丁270番地泉北ビル2階: {
          ...CHAYAMADAI,
          other: '270泉北ビル2階',
          level: 3,
        },
        大阪府堺市南区茶山台1丁270番地: {
          ...CHAYAMADAI,
          other: '270',
          level: 3,
        },
      },
      { level: 3, other: '270', building: '泉北ビル2階', split: 'found' },
    ],
    [
      '号の直後の建物名',
      '東京都中央区銀座2丁目2番12号有馬ビル7F',
      {
        東京都中央区銀座2丁目2番12号有馬ビル7F: {
          ...GINZA,
          number: '2-12',
          other: ' 有馬ビル7F',
          level: 8,
        },
        東京都中央区銀座2丁目2番12号: {
          ...GINZA,
          number: '2-12',
          level: 8,
        },
      },
      {
        number: '2-12',
        level: 8,
        other: '',
        building: '有馬ビル7F',
        split: 'found',
      },
    ],
    [
      '号の直後の階',
      '東京都中央区銀座2丁目4番8号2階',
      {
        東京都中央区銀座2丁目4番8号2階: {
          ...GINZA,
          number: '4-8',
          other: ' 2階',
          level: 8,
        },
        東京都中央区銀座2丁目4番8号: { ...GINZA, number: '4-8', level: 8 },
      },
      { number: '4-8', level: 8, other: '', building: '2階', split: 'found' },
    ],
    [
      'ハイフンでつないだ号は住所側に残す',
      '東京都中央区銀座2丁目3番24-505号',
      {
        '東京都中央区銀座2丁目3番24-505号': {
          ...GINZA,
          other: '3-24-505号',
          level: 3,
        },
      },
      { level: 3, other: '3-24-505号', building: '', split: 'none' },
    ],
    [
      '(1) 建物名の中の空白で切った前半は、other に建物名が残るので受け入れない',
      '兵庫県明石市大久保町ゆりのき通2丁目2番地の1AKASAKA HILLS 302',
      {
        '兵庫県明石市大久保町ゆりのき通2丁目2番地の1AKASAKA HILLS 302': {
          ...AKASHI,
          number: '2-1',
          other: 'AKASAKA HILLS 302',
          level: 8,
        },
        兵庫県明石市大久保町ゆりのき通2丁目2番地の1AKASAKA: {
          ...AKASHI,
          number: '2-1',
          other: 'AKASAKA',
          level: 8,
        },
        兵庫県明石市大久保町ゆりのき通2: { ...AKASHI, level: 3 },
        兵庫県明石市大久保町ゆりのき通2丁目2番地: {
          ...AKASHI,
          other: '2',
          level: 3,
        },
        兵庫県明石市大久保町ゆりのき通2丁目2番地の1: {
          ...AKASHI,
          number: '2-1',
          level: 8,
        },
      },
      {
        number: '2-1',
        level: 8,
        other: '',
        building: 'AKASAKA HILLS 302',
        split: 'found',
      },
    ],
    [
      '(2) データで確定した番地を、level 3 の前半で上書きしない',
      '東京都大田区蒲田5-11-10FUNDES蒲田7階',
      {
        '東京都大田区蒲田5-11-10FUNDES蒲田7階': {
          ...KAMATA,
          number: '11-10',
          other: 'FUNDES蒲田7階',
          level: 8,
        },
        '東京都大田区蒲田5-11': { ...KAMATA, other: '11', level: 3 },
        東京都大田区蒲田5: { ...KAMATA, level: 3 },
        '東京都大田区蒲田5-11-10': { ...KAMATA, number: '11-10', level: 8 },
      },
      {
        number: '11-10',
        level: 8,
        other: '',
        building: 'FUNDES蒲田7階',
        split: 'found',
      },
    ],
    [
      '(2) 空白の後ろの数字が全体の番地の続きなら、空白でも上書きしない',
      '東京都江東区東砂二丁目13番 10号棟101号',
      {
        '東京都江東区東砂二丁目13番 10号棟101号': {
          ...HIGASHISUNA,
          number: '13-10',
          other: '棟101号',
          level: 8,
        },
        東京都江東区東砂二丁目13番: {
          ...HIGASHISUNA,
          other: '13',
          level: 3,
        },
        東京都江東区東砂二: { ...HIGASHISUNA, level: 3 },
        '東京都江東区東砂二丁目13番 10号': {
          ...HIGASHISUNA,
          number: '13-10',
          level: 8,
        },
      },
      { number: '13-10', level: 8, other: '', building: '棟101号' },
    ],
    [
      '(3) 建物部が番地の続き（地＋数字）で始まるなら受け入れない',
      '東京都千代田区六番町9番地9 第三青葉事務所1階',
      {
        '東京都千代田区六番町9番地9 第三青葉事務所1階': {
          ...ROKUBANCHO,
          number: '9-9',
          other: '第三青葉事務所1階',
          level: 8,
        },
        東京都千代田区六番町9番: { ...ROKUBANCHO, other: '9', level: 3 },
        東京都千: { prefecture: '東京都', other: '千', level: 1 },
        東京都千代田区六番: { ...ROKUBANCHO, level: 3 },
        東京都千代田区六番町9番地: { ...ROKUBANCHO, other: '9', level: 3 },
        東京都千代田区六番町9番地9: {
          ...ROKUBANCHO,
          number: '9-9',
          level: 8,
        },
      },
      {
        number: '9-9',
        level: 8,
        other: '',
        building: '第三青葉事務所1階',
        split: 'found',
      },
    ],
    [
      '(4) other がハイフンで終わる前半は受け入れない',
      '大分県臼杵市大字臼杵2の107番地の716',
      {
        大分県臼杵市大字臼杵2の107番地の716: {
          ...USUKI,
          other: '2-107-716',
          level: 3,
        },
        大分県臼杵市大字臼杵2の107番地の: {
          ...USUKI,
          other: '2-107-',
          level: 3,
        },
      },
      { level: 3, other: '2-107-716', building: '', split: 'none' },
    ],
    [
      '番地の間に番・の が残る other（level 3）は読み切れている',
      '神奈川県横浜市神奈川区反町三丁目17番の2 神奈川県社会福祉センター2階',
      {
        '神奈川県横浜市神奈川区反町三丁目17番の2 神奈川県社会福祉センター2階': {
          ...TANMACHI,
          other: '17番の2 神奈川県社会福祉センタ-2階',
          level: 3,
        },
        神奈川県横浜市神奈川区反町三丁目17番の2: {
          ...TANMACHI,
          other: '17番の2',
          level: 3,
        },
      },
      {
        level: 3,
        other: '17番の2',
        building: '神奈川県社会福祉センター2階',
        split: 'found',
      },
    ],
    [
      '建物名の先頭の漢数字を読まれた level 8 は、level 3 の前半で上書きする',
      '東京都新宿区四谷三丁目7番地 四谷無三四堂ビル2階',
      {
        '東京都新宿区四谷三丁目7番地 四谷無三四堂ビル2階': {
          ...YOTSUYA,
          number: '7-4',
          other: '谷無三四堂ビル2階',
          level: 8,
        },
        東京都新宿区四谷三丁目7番地: { ...YOTSUYA, other: '7', level: 3 },
      },
      {
        level: 3,
        other: '7',
        building: '四谷無三四堂ビル2階',
        split: 'found',
      },
    ],
    [
      '全体が level 8 で前半（短い番地）が level 8 未満なら、-NF でも番地を守る',
      '大阪府堺市南区栂３７１－３Ｆ',
      {
        '大阪府堺市南区栂371-3F': {
          ...TOGA,
          number: '371-3',
          other: 'F',
          level: 8,
        },
        大阪府堺市南区栂371: { ...TOGA, other: '371', level: 3 },
        '大阪府堺市南区栂371-3': { ...TOGA, number: '371-3', level: 8 },
      },
      { number: '371-3', level: 8, other: '', building: 'F', split: 'found' },
    ],
    [
      '全体が level 8 の番地（2-9）を、-9F の階の読みで上書きしない',
      '北海道札幌市中央区北一条西５－２－９Ｆ',
      {
        '北海道札幌市中央区北一条西5-2-9F': {
          ...KITAICHIJO,
          number: '2-9',
          other: 'F',
          level: 8,
        },
        '北海道札幌市中央区北一条西5-2': {
          ...KITAICHIJO,
          other: '2',
          level: 3,
        },
        北海道札幌市中央区北一: {
          prefecture: '北海道',
          city: '札幌市中央区',
          other: '北一',
          level: 2,
        },
        北海道札幌市中央区北一条西5: {
          prefecture: '北海道',
          city: '札幌市中央区',
          other: '北一条西5',
          level: 2,
        },
        '北海道札幌市中央区北一条西5-2-9': {
          ...KITAICHIJO,
          number: '2-9',
          level: 8,
        },
      },
      { number: '2-9', level: 8, other: '', building: 'F', split: 'found' },
    ],
    [
      '(1) F の直後が英字なら階と読まず、データの番地を守る',
      '福岡市博多区博多駅南1丁目4-4FUSHIビル2F 203',
      {
        '福岡市博多区博多駅南1丁目4-4FUSHIビル2F 203': {
          ...HAKATA,
          number: '4-4',
          other: 'FUSHIビル2F 203',
          level: 8,
        },
        福岡市博多区博多駅南1丁目4: { ...HAKATA, other: '4', level: 3 },
        福岡市博多区博多駅南1: { ...HAKATA, level: 3 },
        '福岡市博多区博多駅南1丁目4-4': { ...HAKATA, number: '4-4', level: 8 },
      },
      { number: '4-4', level: 8, other: '', building: 'FUSHIビル2F 203' },
    ],
    [
      '(2) 空白の後ろの階は、全体の番地の続きに見えても受け入れる',
      '千葉県松戸市岩瀬１６４番地 １階',
      {
        '千葉県松戸市岩瀬164番地 1階': {
          ...IWASE,
          number: '164-1',
          other: '階',
          level: 8,
        },
        千葉県松戸市岩瀬164番地: { ...IWASE, other: '164', level: 3 },
      },
      { level: 3, other: '164', building: '1階', split: 'found' },
    ],
    [
      '(3) 先頭の長音「ー」も落として階と読む',
      '神奈川県横浜市中区南仲通３－３２－１ー３Ｆ',
      {
        '神奈川県横浜市中区南仲通3-32-1ー3F': {
          ...MINAMINAKADORI,
          other: '32-1-3F',
          level: 3,
        },
        '神奈川県横浜市中区南仲通3-32-1': {
          ...MINAMINAKADORI,
          other: '32-1',
          level: 3,
        },
      },
      { level: 3, other: '32-1', building: '3F', split: 'found' },
    ],
    [
      '(3) 横棒の後ろの数字が階・部屋番号の形でなければ番地の続き',
      '焼津市八楠1ー17ー1FAビレッジ101号',
      {
        焼津市八楠1ー17ー1FAビレッジ101号: {
          ...YAGUSU,
          other: '17-1FAビレッジ101号',
          level: 3,
        },
        焼津市八楠1ー17: { ...YAGUSU, other: '17', level: 3 },
        焼津市八: {
          prefecture: '静岡県',
          city: '焼津市',
          other: '八',
          level: 2,
        },
        焼津市八楠1: { ...YAGUSU, town: '八楠', other: '1', level: 3 },
        焼津市八楠1ー17ー1: { ...YAGUSU, other: '17-1', level: 3 },
      },
      { level: 3, other: '17-1', building: 'FAビレッジ101号', split: 'found' },
    ],
    [
      '(4) 番先を住所の接尾語として扱う',
      '宮城県仙台市若林区六丁目字南６番先６街区５画地２',
      {
        宮城県仙台市若林区六丁目字南6番先6街区5画地2: {
          ...WAKABAYASHI,
          number: '6',
          other: '番先6街区5画地2',
          level: 8,
        },
        宮城県仙台市若林区六丁目字南6番先: {
          ...WAKABAYASHI,
          number: '6',
          other: '番先',
          level: 8,
        },
      },
      {
        number: '6',
        level: 8,
        other: '番先',
        building: '6街区5画地2',
        split: 'found',
      },
    ],
    [
      '(5) 数字の間の「区」も住所として読み切れている',
      '富山県富山市大町２区３００－２大町スタービルＢ棟',
      {
        '富山県富山市大町2区300-2大町スタービルB棟': {
          ...OMACHI,
          other: '2区300-2大町スタービルB棟',
          level: 3,
        },
        '富山県富山市大町2区300-2': { ...OMACHI, other: '2区300-2', level: 3 },
      },
      {
        level: 3,
        other: '2区300-2',
        building: '大町スタービルB棟',
        split: 'found',
      },
    ],
  ];
  for (const [name, input, results, expected] of cases) {
    it(name, async () => {
      const parser = createFakeParser(results);
      const result = await createNormalizeAddress(parser)(input);
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
    });
  }
});

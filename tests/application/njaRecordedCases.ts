/**
 * njaRecordedCases.ts
 *
 * @description 偽の parser に返させる NJA 3.1.3 の実際の結果と、その入力で期待する正規化の結果
 */

import type { ParsedAddress } from '../../src/ports/addressParser.ts';
import type { AddressResult } from '../../src/ports/addressResult.ts';

/** NJA 3.1.3 から取った値で正規化の流れを確かめる1件 */
export interface NjaRecordedCase {
  /** 確かめる現象（テストの名前） */
  readonly name: string;
  readonly input: string;
  /** 偽の parser が返す結果。キーは parser に渡るテキスト。どれも一度は解析される */
  readonly results: Readonly<Record<string, Partial<ParsedAddress>>>;
  /** 結果のうち、確かめる項目 */
  readonly expected: Partial<AddressResult>;
}

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

/** NJA 3.1.3 から取った値の表 */
export const NJA_RECORDED_CASES: readonly NjaRecordedCase[] = [
  {
    name: '建物名の先頭の漢数字を番地に読まれても、前半の結果を使う',
    input: '札幌市中央区南3条西3丁目10番地三信ビル4階',
    results: {
      札幌市中央区南3条西3丁目10番地三信ビル4階: {
        ...SAPPORO,
        unmatched: '10-3信ビル4階',
        level: 3,
      },
      札幌市中央区南3条西3丁目10番地: {
        ...SAPPORO,
        unmatched: '10',
        level: 3,
      },
    },
    expected: {
      level: 3,
      unmatched: '10',
      building: '三信ビル4階',
      split: 'found',
    },
  },
  {
    name: '空白の後ろの階の数字を番地につなげない',
    input: '稲城市向陽台六丁目2番地1 1階',
    results: {
      '稲城市向陽台六丁目2番地1 1階': {
        ...INAGI,
        unmatched: '2-11階',
        level: 3,
      },
      稲城市向陽台六丁目2番地1: { ...INAGI, unmatched: '2-1', level: 3 },
    },
    expected: { level: 3, unmatched: '2-1', building: '1階', split: 'found' },
  },
  {
    name: 'ハイフンでつないだ番号の最後の号室を建物部にする',
    input: '福岡県福岡市中央区清川2-12-4-102号室',
    results: {
      '福岡県福岡市中央区清川2-12-4-102号室': {
        ...KIYOKAWA,
        unmatched: '12-4-102号室',
        level: 3,
      },
      '福岡県福岡市中央区清川2-12-4': {
        ...KIYOKAWA,
        block: '12-4',
        level: 8,
      },
    },
    expected: {
      block: '12-4',
      level: 8,
      unmatched: '',
      building: '102号室',
      split: 'found',
    },
  },
  {
    name: 'level 8 で unmatched に号だけが残れば none',
    input: '秋田県大仙市大曲須和町二丁目3番21―5号',
    results: {
      '秋田県大仙市大曲須和町二丁目3番21―5号': {
        ...DAISEN,
        block: '3-21-5',
        unmatched: '号',
        level: 8,
      },
    },
    expected: {
      block: '3-21-5',
      level: 8,
      unmatched: '号',
      building: '',
      split: 'none',
    },
  },
  {
    name: '空白の後ろの番町で始まる建物名',
    input: '東京都千代田区二番町1-2 番町ハイム209号',
    results: {
      '東京都千代田区二番町1-2 番町ハイム209号': {
        ...NIBANCHO,
        block: '1-2',
        unmatched: '番町ハイム209号',
        level: 8,
      },
      '東京都千代田区二番町1-2': { ...NIBANCHO, block: '1-2', level: 8 },
    },
    expected: {
      block: '1-2',
      level: 8,
      unmatched: '',
      building: '番町ハイム209号',
      split: 'found',
    },
  },
  {
    name: '号の直後の番町で始まる建物名',
    input: '東京都千代田区紀尾井町1番3号番町YMビル',
    results: {
      東京都千代田区紀尾井町1番3号番町YMビル: {
        ...KIOICHO,
        block: '1-3',
        unmatched: ' 番町YMビル',
        level: 8,
      },
      東京都千代田区紀尾井町1番3号: {
        ...KIOICHO,
        block: '1-3',
        level: 8,
      },
    },
    expected: {
      block: '1-3',
      level: 8,
      unmatched: '',
      building: '番町YMビル',
      split: 'found',
    },
  },
  {
    name: '号の直後の地下で始まる建物部',
    input: '東京都千代田区紀尾井町1番9号地下1階',
    results: {
      東京都千代田区紀尾井町1番9号地下1階: {
        ...KIOICHO,
        block: '1-9',
        unmatched: ' 地下1階',
        level: 8,
      },
      東京都千代田区紀尾井町1番9号: {
        ...KIOICHO,
        block: '1-9',
        level: 8,
      },
    },
    expected: {
      block: '1-9',
      level: 8,
      unmatched: '',
      building: '地下1階',
      split: 'found',
    },
  },
  {
    name: '番地の直後の建物名（level 3）',
    input: '大阪府堺市南区茶山台1丁270番地泉北ビル2階',
    results: {
      大阪府堺市南区茶山台1丁270番地泉北ビル2階: {
        ...CHAYAMADAI,
        unmatched: '270泉北ビル2階',
        level: 3,
      },
      大阪府堺市南区茶山台1丁270番地: {
        ...CHAYAMADAI,
        unmatched: '270',
        level: 3,
      },
    },
    expected: {
      level: 3,
      unmatched: '270',
      building: '泉北ビル2階',
      split: 'found',
    },
  },
  {
    name: '号の直後の建物名',
    input: '東京都中央区銀座2丁目2番12号有馬ビル7F',
    results: {
      東京都中央区銀座2丁目2番12号有馬ビル7F: {
        ...GINZA,
        block: '2-12',
        unmatched: ' 有馬ビル7F',
        level: 8,
      },
      東京都中央区銀座2丁目2番12号: {
        ...GINZA,
        block: '2-12',
        level: 8,
      },
    },
    expected: {
      block: '2-12',
      level: 8,
      unmatched: '',
      building: '有馬ビル7F',
      split: 'found',
    },
  },
  {
    name: '号の直後の階',
    input: '東京都中央区銀座2丁目4番8号2階',
    results: {
      東京都中央区銀座2丁目4番8号2階: {
        ...GINZA,
        block: '4-8',
        unmatched: ' 2階',
        level: 8,
      },
      東京都中央区銀座2丁目4番8号: { ...GINZA, block: '4-8', level: 8 },
    },
    expected: {
      block: '4-8',
      level: 8,
      unmatched: '',
      building: '2階',
      split: 'found',
    },
  },
  {
    name: 'ハイフンでつないだ号は住所側に残す',
    input: '東京都中央区銀座2丁目3番24-505号',
    results: {
      '東京都中央区銀座2丁目3番24-505号': {
        ...GINZA,
        unmatched: '3-24-505号',
        level: 3,
      },
    },
    expected: {
      level: 3,
      unmatched: '3-24-505号',
      building: '',
      split: 'none',
    },
  },
  {
    name: '建物名の中の空白で切った前半は、unmatched に建物名が残るので受け入れない',
    input: '兵庫県明石市大久保町ゆりのき通2丁目2番地の1AKASAKA HILLS 302',
    results: {
      '兵庫県明石市大久保町ゆりのき通2丁目2番地の1AKASAKA HILLS 302': {
        ...AKASHI,
        block: '2-1',
        unmatched: 'AKASAKA HILLS 302',
        level: 8,
      },
      兵庫県明石市大久保町ゆりのき通2丁目2番地の1AKASAKA: {
        ...AKASHI,
        block: '2-1',
        unmatched: 'AKASAKA',
        level: 8,
      },
      兵庫県明石市大久保町ゆりのき通2: { ...AKASHI, level: 3 },
      兵庫県明石市大久保町ゆりのき通2丁目2番地: {
        ...AKASHI,
        unmatched: '2',
        level: 3,
      },
      兵庫県明石市大久保町ゆりのき通2丁目2番地の1: {
        ...AKASHI,
        block: '2-1',
        level: 8,
      },
    },
    expected: {
      block: '2-1',
      level: 8,
      unmatched: '',
      building: 'AKASAKA HILLS 302',
      split: 'found',
    },
  },
  {
    name: 'データで確定した番地を、level 3 の前半で上書きしない',
    input: '東京都大田区蒲田5-11-10FUNDES蒲田7階',
    results: {
      '東京都大田区蒲田5-11-10FUNDES蒲田7階': {
        ...KAMATA,
        block: '11-10',
        unmatched: 'FUNDES蒲田7階',
        level: 8,
      },
      '東京都大田区蒲田5-11': { ...KAMATA, unmatched: '11', level: 3 },
      東京都大田区蒲田5: { ...KAMATA, level: 3 },
      '東京都大田区蒲田5-11-10': { ...KAMATA, block: '11-10', level: 8 },
    },
    expected: {
      block: '11-10',
      level: 8,
      unmatched: '',
      building: 'FUNDES蒲田7階',
      split: 'found',
    },
  },
  {
    name: '空白の後ろの数字が全体の番地の続きなら、空白でも上書きしない',
    input: '東京都江東区東砂二丁目13番 10号棟101号',
    results: {
      '東京都江東区東砂二丁目13番 10号棟101号': {
        ...HIGASHISUNA,
        block: '13-10',
        unmatched: '棟101号',
        level: 8,
      },
      東京都江東区東砂二丁目13番: {
        ...HIGASHISUNA,
        unmatched: '13',
        level: 3,
      },
      東京都江東区東砂二: { ...HIGASHISUNA, level: 3 },
      '東京都江東区東砂二丁目13番 10号': {
        ...HIGASHISUNA,
        block: '13-10',
        level: 8,
      },
    },
    expected: { block: '13-10', level: 8, unmatched: '', building: '棟101号' },
  },
  {
    name: '建物部が番地の続き（地＋数字）で始まるなら受け入れない',
    input: '東京都千代田区六番町9番地9 第三青葉事務所1階',
    results: {
      '東京都千代田区六番町9番地9 第三青葉事務所1階': {
        ...ROKUBANCHO,
        block: '9-9',
        unmatched: '第三青葉事務所1階',
        level: 8,
      },
      東京都千代田区六番町9番: { ...ROKUBANCHO, unmatched: '9', level: 3 },
      東京都千: { prefecture: '東京都', unmatched: '千', level: 1 },
      東京都千代田区六番: { ...ROKUBANCHO, level: 3 },
      東京都千代田区六番町9番地: { ...ROKUBANCHO, unmatched: '9', level: 3 },
      東京都千代田区六番町9番地9: {
        ...ROKUBANCHO,
        block: '9-9',
        level: 8,
      },
    },
    expected: {
      block: '9-9',
      level: 8,
      unmatched: '',
      building: '第三青葉事務所1階',
      split: 'found',
    },
  },
  {
    name: 'unmatched がハイフンで終わる前半は受け入れない',
    input: '大分県臼杵市大字臼杵2の107番地の716',
    results: {
      大分県臼杵市大字臼杵2の107番地の716: {
        ...USUKI,
        unmatched: '2-107-716',
        level: 3,
      },
      大分県臼杵市大字臼杵2の107番地の: {
        ...USUKI,
        unmatched: '2-107-',
        level: 3,
      },
    },
    expected: { level: 3, unmatched: '2-107-716', building: '', split: 'none' },
  },
  {
    name: '番地の間に番・の が残る unmatched（level 3）は読み切れている',
    input:
      '神奈川県横浜市神奈川区反町三丁目17番の2 神奈川県社会福祉センター2階',
    results: {
      '神奈川県横浜市神奈川区反町三丁目17番の2 神奈川県社会福祉センター2階': {
        ...TANMACHI,
        unmatched: '17番の2 神奈川県社会福祉センタ-2階',
        level: 3,
      },
      神奈川県横浜市神奈川区反町三丁目17番の2: {
        ...TANMACHI,
        unmatched: '17番の2',
        level: 3,
      },
    },
    expected: {
      level: 3,
      unmatched: '17番の2',
      building: '神奈川県社会福祉センター2階',
      split: 'found',
    },
  },
  {
    name: '建物名の先頭の漢数字を読まれた level 8 は、level 3 の前半で上書きする',
    input: '東京都新宿区四谷三丁目7番地 四谷無三四堂ビル2階',
    results: {
      '東京都新宿区四谷三丁目7番地 四谷無三四堂ビル2階': {
        ...YOTSUYA,
        block: '7-4',
        unmatched: '谷無三四堂ビル2階',
        level: 8,
      },
      東京都新宿区四谷三丁目7番地: { ...YOTSUYA, unmatched: '7', level: 3 },
    },
    expected: {
      level: 3,
      unmatched: '7',
      building: '四谷無三四堂ビル2階',
      split: 'found',
    },
  },
  {
    name: '全体が level 8 で前半（短い番地）が level 8 未満なら、-NF でも番地を守る',
    input: '大阪府堺市南区栂３７１－３Ｆ',
    results: {
      '大阪府堺市南区栂371-3F': {
        ...TOGA,
        block: '371-3',
        unmatched: 'F',
        level: 8,
      },
      大阪府堺市南区栂371: { ...TOGA, unmatched: '371', level: 3 },
      '大阪府堺市南区栂371-3': { ...TOGA, block: '371-3', level: 8 },
    },
    expected: {
      block: '371-3',
      level: 8,
      unmatched: '',
      building: 'F',
      split: 'found',
    },
  },
  {
    name: '全体が level 8 の番地（2-9）を、-9F の階の読みで上書きしない',
    input: '北海道札幌市中央区北一条西５－２－９Ｆ',
    results: {
      '北海道札幌市中央区北一条西5-2-9F': {
        ...KITAICHIJO,
        block: '2-9',
        unmatched: 'F',
        level: 8,
      },
      '北海道札幌市中央区北一条西5-2': {
        ...KITAICHIJO,
        unmatched: '2',
        level: 3,
      },
      北海道札幌市中央区北一: {
        prefecture: '北海道',
        city: '札幌市中央区',
        unmatched: '北一',
        level: 2,
      },
      北海道札幌市中央区北一条西5: {
        prefecture: '北海道',
        city: '札幌市中央区',
        unmatched: '北一条西5',
        level: 2,
      },
      '北海道札幌市中央区北一条西5-2-9': {
        ...KITAICHIJO,
        block: '2-9',
        level: 8,
      },
    },
    expected: {
      block: '2-9',
      level: 8,
      unmatched: '',
      building: 'F',
      split: 'found',
    },
  },
  {
    name: 'F の直後が英字なら階と読まず、データの番地を守る',
    input: '福岡市博多区博多駅南1丁目4-4FUSHIビル2F 203',
    results: {
      '福岡市博多区博多駅南1丁目4-4FUSHIビル2F 203': {
        ...HAKATA,
        block: '4-4',
        unmatched: 'FUSHIビル2F 203',
        level: 8,
      },
      福岡市博多区博多駅南1丁目4: { ...HAKATA, unmatched: '4', level: 3 },
      福岡市博多区博多駅南1: { ...HAKATA, level: 3 },
      '福岡市博多区博多駅南1丁目4-4': { ...HAKATA, block: '4-4', level: 8 },
    },
    expected: {
      block: '4-4',
      level: 8,
      unmatched: '',
      building: 'FUSHIビル2F 203',
    },
  },
  {
    name: '空白の後ろの階は、全体の番地の続きに見えても受け入れる',
    input: '千葉県松戸市岩瀬１６４番地 １階',
    results: {
      '千葉県松戸市岩瀬164番地 1階': {
        ...IWASE,
        block: '164-1',
        unmatched: '階',
        level: 8,
      },
      千葉県松戸市岩瀬164番地: { ...IWASE, unmatched: '164', level: 3 },
    },
    expected: { level: 3, unmatched: '164', building: '1階', split: 'found' },
  },
  {
    name: '先頭の長音「ー」も落として階と読む',
    input: '神奈川県横浜市中区南仲通３－３２－１ー３Ｆ',
    results: {
      '神奈川県横浜市中区南仲通3-32-1ー3F': {
        ...MINAMINAKADORI,
        unmatched: '32-1-3F',
        level: 3,
      },
      '神奈川県横浜市中区南仲通3-32-1': {
        ...MINAMINAKADORI,
        unmatched: '32-1',
        level: 3,
      },
    },
    expected: { level: 3, unmatched: '32-1', building: '3F', split: 'found' },
  },
  {
    name: '横棒の後ろの数字が階・部屋番号の形でなければ番地の続き',
    input: '焼津市八楠1ー17ー1FAビレッジ101号',
    results: {
      焼津市八楠1ー17ー1FAビレッジ101号: {
        ...YAGUSU,
        unmatched: '17-1FAビレッジ101号',
        level: 3,
      },
      焼津市八楠1ー17: { ...YAGUSU, unmatched: '17', level: 3 },
      焼津市八: {
        prefecture: '静岡県',
        city: '焼津市',
        unmatched: '八',
        level: 2,
      },
      焼津市八楠1: { ...YAGUSU, town: '八楠', unmatched: '1', level: 3 },
      焼津市八楠1ー17ー1: { ...YAGUSU, unmatched: '17-1', level: 3 },
    },
    expected: {
      level: 3,
      unmatched: '17-1',
      building: 'FAビレッジ101号',
      split: 'found',
    },
  },
  {
    name: '番先を住所の接尾語として扱う',
    input: '宮城県仙台市若林区六丁目字南６番先６街区５画地２',
    results: {
      宮城県仙台市若林区六丁目字南6番先6街区5画地2: {
        ...WAKABAYASHI,
        block: '6',
        unmatched: '番先6街区5画地2',
        level: 8,
      },
      宮城県仙台市若林区六丁目字南6番先: {
        ...WAKABAYASHI,
        block: '6',
        unmatched: '番先',
        level: 8,
      },
    },
    expected: {
      block: '6',
      level: 8,
      unmatched: '番先',
      building: '6街区5画地2',
      split: 'found',
    },
  },
  {
    name: '数字の間の「区」も住所として読み切れている',
    input: '富山県富山市大町２区３００－２大町スタービルＢ棟',
    results: {
      '富山県富山市大町2区300-2大町スタービルB棟': {
        ...OMACHI,
        unmatched: '2区300-2大町スタービルB棟',
        level: 3,
      },
      '富山県富山市大町2区300-2': {
        ...OMACHI,
        unmatched: '2区300-2',
        level: 3,
      },
    },
    expected: {
      level: 3,
      unmatched: '2区300-2',
      building: '大町スタービルB棟',
      split: 'found',
    },
  },
];

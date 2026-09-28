import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildingStarts,
  isAddressFront,
  isSameAddress,
  splitCandidates,
  toBuilding,
  wholeTail,
} from '../../src/domain/split.ts';
import type { ParsedAddress } from '../../src/ports/addressParser.ts';

const parsed = (fields: Partial<ParsedAddress>): ParsedAddress => ({
  unmatched: '',
  level: 3,
  raw: {},
  ...fields,
});

describe('splitCandidates', () => {
  const cases: [string, string, number[]][] = [
    ['数字の直後で次が数字でない位置', '坂1-2-3 ビル', [2, 4, 6]],
    ['番地・号の直後', '1番地2号ビル', [3, 5]],
    ['号の直後は数字でも候補', '1号2階', [2, 3]],
    ['地の直後は数字でも候補', '5地1', [2]],
    ['数字の直後が号・番・地なら候補にしない', '28番9号', []],
    ['番の直後が数字・地なら候補にしない', '1番2番地ビル', [5]],
    ['目の直後が番なら候補にしない', '目番ビル', [2]],
    ['漢数字の直後', '一丁目三ビル', [1, 3, 4]],
    ['直後が数字なら候補にしない', '目12ビル', [3]],
    ['末尾は候補にしない', 'ビル1', []],
    ['先頭は候補にしない', '1ビル', [1]],
    ['空文字', '', []],
    ['候補が無い', '東京都渋谷区', []],
  ];
  for (const [name, text, expected] of cases) {
    it(name, () => {
      assert.deepEqual(splitCandidates(text), expected);
    });
  }
});

describe('wholeTail', () => {
  it('level 8 は block が末尾で unmatched が残り', () => {
    assert.deepEqual(
      wholeTail(parsed({ level: 8, block: '2-3', unmatched: ' タワ-12F' })),
      { tail: '2-3', rest: ' タワ-12F' },
    );
  });
  it('level 8 で unmatched の先頭の号は残りから除く', () => {
    assert.deepEqual(
      wholeTail(parsed({ level: 8, block: '3-21-5', unmatched: '号' })),
      { tail: '3-21-5', rest: '' },
    );
    assert.deepEqual(
      wholeTail(parsed({ level: 8, block: '4-8', unmatched: '番地ビル' })),
      { tail: '4-8', rest: 'ビル' },
    );
  });
  it('番先・地先・番地先も接尾語として除く', () => {
    assert.deepEqual(
      wholeTail(parsed({ level: 8, block: '6', unmatched: '番先6街区' })),
      { tail: '6', rest: '6街区' },
    );
    assert.deepEqual(wholeTail(parsed({ unmatched: '4番地先数寄屋' })), {
      tail: '4',
      rest: '数寄屋',
    });
  });
  it('level 8 で先頭の号を除くのは1回だけ', () => {
    assert.deepEqual(
      wholeTail(parsed({ level: 8, block: '1-9', unmatched: '号地下1階' })),
      { tail: '1-9', rest: '地下1階' },
    );
  });
  it('level 3 は unmatched の先頭の番地らしい部分が末尾', () => {
    assert.deepEqual(wholeTail(parsed({ unmatched: '12-3-4 ビル5F' })), {
      tail: '12-3-4',
      rest: ' ビル5F',
    });
  });
  it('level 3 で番地らしい部分が無ければ末尾は空', () => {
    assert.deepEqual(wholeTail(parsed({ unmatched: 'ビル' })), {
      tail: '',
      rest: 'ビル',
    });
  });
  it('level 3 で番地らしい部分の直後の号は残りから除く', () => {
    assert.deepEqual(wholeTail(parsed({ unmatched: '5-15-2号' })), {
      tail: '5-15-2',
      rest: '',
    });
    assert.deepEqual(wholeTail(parsed({ unmatched: '28-9号2階' })), {
      tail: '28-9',
      rest: '2階',
    });
  });
  it('level 3 で番地らしい部分の直後の番地は最長一致で除く', () => {
    assert.deepEqual(wholeTail(parsed({ unmatched: '1番地ビル' })), {
      tail: '1',
      rest: 'ビル',
    });
  });
  it('番地らしい部分が無ければ号を除かない', () => {
    assert.deepEqual(wholeTail(parsed({ unmatched: '号室' })), {
      tail: '',
      rest: '号室',
    });
  });
  it('末尾のハイフンは番地に含めない', () => {
    assert.deepEqual(wholeTail(parsed({ unmatched: '1-2-' })), {
      tail: '1-2',
      rest: '-',
    });
  });
});

describe('isSameAddress', () => {
  const whole = parsed({
    prefecture: '東京都',
    city: '渋谷区',
    town: '道玄坂一丁目',
    block: '2-3',
    level: 8,
  });
  const cases: [string, Partial<ParsedAddress>, string, boolean][] = [
    [
      'block が一致',
      {
        prefecture: '東京都',
        city: '渋谷区',
        town: '道玄坂一丁目',
        block: '2-3',
      },
      '2-3',
      true,
    ],
    [
      'block が無く unmatched が一致',
      {
        prefecture: '東京都',
        city: '渋谷区',
        town: '道玄坂一丁目',
        unmatched: '2-3',
      },
      '2-3',
      true,
    ],
    [
      'block と unmatched を - でつなぐ',
      {
        prefecture: '東京都',
        city: '渋谷区',
        town: '道玄坂一丁目',
        block: '2',
        unmatched: '3',
      },
      '2-3',
      true,
    ],
    [
      'unmatched の末尾の号を落として一致',
      {
        prefecture: '東京都',
        city: '渋谷区',
        town: '道玄坂一丁目',
        unmatched: '2-3号',
      },
      '2-3',
      true,
    ],
    [
      'block と、末尾の番地を落とした unmatched をつなぐ',
      {
        prefecture: '東京都',
        city: '渋谷区',
        town: '道玄坂一丁目',
        block: '2',
        unmatched: '3番地',
      },
      '2-3',
      true,
    ],
    [
      '号だけの unmatched は落として block と比べる',
      {
        prefecture: '東京都',
        city: '渋谷区',
        town: '道玄坂一丁目',
        block: '2-3',
        unmatched: '号',
      },
      '2-3',
      true,
    ],
    [
      '住所の末尾が違う',
      {
        prefecture: '東京都',
        city: '渋谷区',
        town: '道玄坂一丁目',
        block: '2',
      },
      '2-3',
      false,
    ],
    [
      '町字が違う',
      {
        prefecture: '東京都',
        city: '渋谷区',
        town: '道玄坂二丁目',
        block: '2-3',
      },
      '2-3',
      false,
    ],
    [
      '市区町村が違う',
      {
        prefecture: '東京都',
        city: '港区',
        town: '道玄坂一丁目',
        block: '2-3',
      },
      '2-3',
      false,
    ],
    [
      '都道府県が違う',
      { city: '渋谷区', town: '道玄坂一丁目', block: '2-3' },
      '2-3',
      false,
    ],
    [
      '末尾が空どうし',
      { prefecture: '東京都', city: '渋谷区', town: '道玄坂一丁目' },
      '',
      true,
    ],
  ];
  for (const [name, front, tail, expected] of cases) {
    it(name, () => {
      assert.equal(isSameAddress(whole, tail, parsed(front)), expected);
    });
  }
});

describe('toBuilding', () => {
  const cases: [string, string, string][] = [
    ['前後の空白を落とす', ' ビル5F ', 'ビル5F'],
    ['先頭のハイフンを落とす', '-B1F', 'B1F'],
    ['続いたハイフンはすべて落とす', '--B1F', 'B1F'],
    ['ハイフンの後の空白も落とす', ' - B1F', 'B1F'],
    ['途中のハイフンは残す', 'B-1', 'B-1'],
    ['ハイフンだけなら空', ' - ', ''],
    ['先頭の長音も落とす', 'ー3F', '3F'],
    ['全角ハイフン・横棒も落とす', '\uff0d\u2015 B1F', 'B1F'],
    ['途中の長音は残す', 'タワー', 'タワー'],
  ];
  for (const [name, text, expected] of cases) {
    it(name, () => {
      assert.equal(toBuilding(text), expected);
    });
  }
});

describe('buildingStarts', () => {
  const at = (text: string, part: string): number[] => [text.indexOf(part)];
  const cases: [string, string, number[]][] = [
    [
      'abr-geocoder の規則で番地の後ろに入る空白',
      '札幌市中央区南3条西3丁目10番地三信ビル4階',
      at('札幌市中央区南3条西3丁目10番地三信ビル4階', '三信'),
    ],
    [
      '利用者が入れた空白（前半は空白を含めない）',
      '稲城市向陽台六丁目2番地1 1階',
      at('稲城市向陽台六丁目2番地1 1階', ' 1階'),
    ],
    [
      '号の後ろ（号は前半に残す）',
      '東京都千代田区紀尾井町1番3号番町YMビル',
      at('東京都千代田区紀尾井町1番3号番町YMビル', '番町Y'),
    ],
    [
      '部屋番号の前のハイフンは前半に含めない',
      '東京都千代田区三崎町三丁目2番6-1104号室レジディア水道橋',
      at('東京都千代田区三崎町三丁目2番6-1104号室レジディア水道橋', '-1104'),
    ],
    [
      '括弧の前',
      '神戸市東灘区向洋町中1-14(イーストコート2番街)',
      at('神戸市東灘区向洋町中1-14(イーストコート2番街)', '('),
    ],
    [
      '独自の規則：3つ以上の番号の後ろの -N号室',
      '福岡県福岡市中央区清川2-12-4-102号室',
      at('福岡県福岡市中央区清川2-12-4-102号室', '-102'),
    ],
    [
      '独自の規則：横棒は置き換えた写しで判定し、元の位置で返す',
      '福岡県福岡市中央区清川2―12―4―102室',
      at('福岡県福岡市中央区清川2―12―4―102室', '―102'),
    ],
    ['2つの番号の後ろの号室には独自の規則を当てない', '清川12-4-102号室', []],
    ['最初の算用数字より前の空白は使わない', '東京都 千代田区 紀尾井町', []],
    ['読点の前に入る空白は数字より前', '東京都港区、六本木1-2-3', []],
    ['住所で終わる', '東京都千代田区紀尾井町1番3号', []],
    ['挿入した字だけなら使わない', '1ー2ー3ー101号室', []],
    ['空文字', '', []],
  ];
  for (const [name, text, expected] of cases) {
    it(name, () => {
      assert.deepEqual(buildingStarts(text), expected);
    });
  }
});

describe('isAddressFront', () => {
  const area = {
    prefecture: '北海道',
    city: '札幌市中央区',
    town: '南三条西三丁目',
  };
  const level3 = parsed({ ...area, unmatched: '10-3信ビル4階' });
  const level8 = parsed({
    ...area,
    block: '10-3',
    unmatched: '信ビル',
    level: 8,
  });
  const noTail = parsed({ ...area, unmatched: '字北ノ作305-5クレオビル2F' });
  type FrontCase = [
    string,
    ParsedAddress,
    Partial<ParsedAddress>,
    string,
    boolean,
  ];
  const describeFrontCases = (title: string, cases: FrontCase[]): void => {
    describe(title, () => {
      for (const [name, whole, front, after, expected] of cases) {
        it(name, () => {
          assert.equal(isAddressFront(whole, parsed(front), after), expected);
        });
      }
    });
  };

  describeFrontCases('地域・level・前半の住所の末尾', [
    [
      '地域が一致し末尾がある（level 3）',
      level3,
      { ...area, unmatched: '10' },
      'ビル',
      true,
    ],
    [
      '住所の末尾が全体と違ってもよい',
      level3,
      { ...area, block: '10-2', level: 8 },
      'ビル',
      true,
    ],
    ['住所の末尾が空', level3, { ...area, unmatched: '' }, 'ビル', false],
    ['住所の末尾が号だけ', level3, { ...area, unmatched: '号' }, 'ビル', false],
    [
      'level が 3 未満',
      level3,
      { ...area, unmatched: '10', level: 2 },
      'ビル',
      false,
    ],
    [
      '町字が違う',
      level3,
      { ...area, town: '南三条西四丁目', unmatched: '10' },
      'ビル',
      false,
    ],
  ]);

  describeFrontCases('前半が住所として読み切れている（全体の末尾がある）', [
    [
      'P1：unmatched に建物名が残る',
      level3,
      { ...area, unmatched: '10 AKASAKA' },
      'HILLS',
      false,
    ],
    [
      'P1：unmatched がハイフンで終わる',
      level3,
      { ...area, unmatched: '2-107-' },
      '716',
      false,
    ],
    [
      'P1：番地の間の 番・の は読み切れている',
      level3,
      { ...area, unmatched: '17番の2' },
      'ビル',
      true,
    ],
    [
      'P1：番地の間の 番- と末尾の号',
      level3,
      { ...area, unmatched: '2番-21号' },
      'ビル',
      true,
    ],
    [
      'P1：数字の間の 区',
      level3,
      { ...area, unmatched: '2区300-2' },
      'ビル',
      true,
    ],
    ['P1：末尾の番先', level3, { ...area, unmatched: '1番先' }, 'ビル', true],
    [
      'P1：level 8 の前半の unmatched が接尾語だけ',
      level3,
      { ...area, block: '6', unmatched: '番先', level: 8 },
      '6街区',
      true,
    ],
    [
      'P1：level 8 の前半の unmatched が空でも接尾語だけでもない',
      level3,
      { ...area, block: '10', unmatched: 'AKASAKA', level: 8 },
      'HILLS',
      false,
    ],
  ]);

  describeFrontCases('前半が住所として読み切れている（全体の末尾が空）', [
    [
      'P1：全体の末尾が空なら、全体の unmatched の先頭と一致し数字で終わる',
      noTail,
      { ...area, unmatched: '字北ノ作305-5' },
      'クレオビル2F',
      true,
    ],
    [
      'P1：全体の末尾が空なら、全体の unmatched の先頭の短い部分でもよい',
      noTail,
      { ...area, unmatched: '字北ノ作305' },
      ' ビル',
      true,
    ],
    [
      'P1：全体の末尾が空で、全体の unmatched の先頭と一致しない',
      noTail,
      { ...area, unmatched: '字南ノ作305' },
      'ビル',
      false,
    ],
    [
      'P1：全体の末尾が空で、前半の unmatched が数字で終わらない',
      noTail,
      { ...area, unmatched: '字北ノ作305-5クレオ' },
      'ビル2F',
      false,
    ],
  ]);

  describeFrontCases('建物部が住所の続きで始まらない', [
    [
      'P2：建物部が 地＋数字 で始まる',
      level3,
      { ...area, unmatched: '9' },
      '地9 ビル',
      false,
    ],
    [
      'P2：建物部が の＋数字 で始まる',
      level3,
      { ...area, unmatched: '6' },
      'の4ビル',
      false,
    ],
    [
      'P2：建物部が 番先＋数字 で始まる',
      level3,
      { ...area, unmatched: '6' },
      '番先6街区',
      false,
    ],
    [
      'P2：建物部が 線 で始まる',
      level3,
      { ...area, unmatched: '1' },
      '線2号',
      false,
    ],
    [
      'P2：先頭のハイフンは落としてから見る',
      level3,
      { ...area, unmatched: '10' },
      '-202号室',
      true,
    ],
    [
      'P2：横棒の後ろの数字だけは枝番',
      level3,
      { ...area, unmatched: '1646' },
      'ー1',
      false,
    ],
    [
      'P2：横棒の後ろの 数字＋F＋英字 は番地の続き',
      level3,
      { ...area, unmatched: '17' },
      'ー1FAビレッジ',
      false,
    ],
    [
      'P2：横棒の後ろの 数字＋F＋記号 は階',
      level3,
      { ...area, unmatched: '8-13' },
      '-4F-CD号室',
      true,
    ],
    [
      'P2：横棒の後ろの 数字＋階＋英字 は階',
      level3,
      { ...area, unmatched: '15-7' },
      '-1階B',
      true,
    ],
  ]);

  describeFrontCases('データで確定した番地を上書きしない', [
    [
      'P3：全体が level 8 で前半が level 3 なら受け入れない',
      level8,
      { ...area, unmatched: '10' },
      '3FUNDES',
      false,
    ],
    [
      'P3：前半も level 8 なら受け入れる',
      level8,
      { ...area, block: '10', level: 8 },
      '3階',
      true,
    ],
    [
      'P3：建物部が漢数字で始まれば受け入れる',
      level8,
      { ...area, unmatched: '10' },
      '三信ビル',
      true,
    ],
    [
      'P3：空白で始まれば受け入れる',
      level8,
      { ...area, unmatched: '10' },
      ' 2階',
      true,
    ],
    [
      'P3：空白で始まっても、先頭の数字が全体の番地の続きなら受け入れない',
      level8,
      { ...area, unmatched: '10' },
      ' 3号棟',
      false,
    ],
    [
      'P3：空白の無い階の形は受け入れない（前半が level 8 未満）',
      level8,
      { ...area, unmatched: '10' },
      '-3F',
      false,
    ],
    [
      'P3：空白の後ろの階の形は、番地の続きに見えても受け入れる',
      level8,
      { ...area, unmatched: '10' },
      ' 3階',
      true,
    ],
    [
      'P3：空白の後ろでも F の直後が英字なら階でない',
      level8,
      { ...area, unmatched: '10' },
      ' 3FUSHI',
      false,
    ],
    [
      'P3：空白の後ろでも F の直後が & なら階でない',
      level8,
      { ...area, unmatched: '10' },
      ' 3F&Gビル',
      false,
    ],
    [
      'P3：空白の後ろでも F の直後が片仮名なら階でない',
      level8,
      { ...area, unmatched: '10' },
      ' 3Fビル1F',
      false,
    ],
    [
      'P3：空白の後ろで F の直後が ( なら階',
      level8,
      { ...area, unmatched: '10' },
      ' 3F(77号室)',
      true,
    ],
  ]);
});

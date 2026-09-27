import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isSameAddress,
  splitCandidates,
  toBuilding,
  wholeTail,
} from '../../src/domain/split.ts';
import type { ParsedAddress } from '../../src/ports/addressParser.ts';

const parsed = (fields: Partial<ParsedAddress>): ParsedAddress => ({
  other: '',
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
  it('level 8 は number が末尾で other が残り', () => {
    assert.deepEqual(
      wholeTail(parsed({ level: 8, number: '2-3', other: ' タワ-12F' })),
      { tail: '2-3', rest: ' タワ-12F' },
    );
  });
  it('level 3 は other の先頭の番地らしい部分が末尾', () => {
    assert.deepEqual(wholeTail(parsed({ other: '12-3-4 ビル5F' })), {
      tail: '12-3-4',
      rest: ' ビル5F',
    });
  });
  it('level 3 で番地らしい部分が無ければ末尾は空', () => {
    assert.deepEqual(wholeTail(parsed({ other: 'ビル' })), {
      tail: '',
      rest: 'ビル',
    });
  });
  it('level 3 で番地らしい部分の直後の号は残りから除く', () => {
    assert.deepEqual(wholeTail(parsed({ other: '5-15-2号' })), {
      tail: '5-15-2',
      rest: '',
    });
    assert.deepEqual(wholeTail(parsed({ other: '28-9号2階' })), {
      tail: '28-9',
      rest: '2階',
    });
  });
  it('level 3 で番地らしい部分の直後の番地は最長一致で除く', () => {
    assert.deepEqual(wholeTail(parsed({ other: '1番地ビル' })), {
      tail: '1',
      rest: 'ビル',
    });
  });
  it('番地らしい部分が無ければ号を除かない', () => {
    assert.deepEqual(wholeTail(parsed({ other: '号室' })), {
      tail: '',
      rest: '号室',
    });
  });
  it('末尾のハイフンは番地に含めない', () => {
    assert.deepEqual(wholeTail(parsed({ other: '1-2-' })), {
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
    number: '2-3',
    level: 8,
  });
  const cases: [string, Partial<ParsedAddress>, string, boolean][] = [
    [
      'number が一致',
      {
        prefecture: '東京都',
        city: '渋谷区',
        town: '道玄坂一丁目',
        number: '2-3',
      },
      '2-3',
      true,
    ],
    [
      'number が無く other が一致',
      {
        prefecture: '東京都',
        city: '渋谷区',
        town: '道玄坂一丁目',
        other: '2-3',
      },
      '2-3',
      true,
    ],
    [
      'number と other を - でつなぐ',
      {
        prefecture: '東京都',
        city: '渋谷区',
        town: '道玄坂一丁目',
        number: '2',
        other: '3',
      },
      '2-3',
      true,
    ],
    [
      'other の末尾の号を落として一致',
      {
        prefecture: '東京都',
        city: '渋谷区',
        town: '道玄坂一丁目',
        other: '2-3号',
      },
      '2-3',
      true,
    ],
    [
      'number と、末尾の番地を落とした other をつなぐ',
      {
        prefecture: '東京都',
        city: '渋谷区',
        town: '道玄坂一丁目',
        number: '2',
        other: '3番地',
      },
      '2-3',
      true,
    ],
    [
      '号だけの other は落として number と比べる',
      {
        prefecture: '東京都',
        city: '渋谷区',
        town: '道玄坂一丁目',
        number: '2-3',
        other: '号',
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
        number: '2',
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
        number: '2-3',
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
        number: '2-3',
      },
      '2-3',
      false,
    ],
    [
      '都道府県が違う',
      { city: '渋谷区', town: '道玄坂一丁目', number: '2-3' },
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
  ];
  for (const [name, text, expected] of cases) {
    it(name, () => {
      assert.equal(toBuilding(text), expected);
    });
  }
});

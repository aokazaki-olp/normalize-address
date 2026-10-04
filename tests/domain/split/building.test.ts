import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isLeftoverMark,
  toBuilding,
} from '../../../src/domain/split/building.ts';

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

describe('isLeftoverMark', () => {
  const cases: [string, string, boolean][] = [
    ['F だけなら true', 'F', true],
    ['横棒のあとの F も true', '-F', true],
    ['F と中黒の続きなら true', 'F・2F', true],
    ['階で始まれば true', '階100号室', true],
    ['号室で始まれば true', '号室', true],
    ['空白のあとの F・ は建物名なので false', ' F・Iビル4階', false],
    ['空白のあとの F( は建物名なので false', ' F(エフ)医療モール1階', false],
    ['空白のあとの階で始まる建物名は false', ' 階上ハイツ', false],
    ['室町で始まる建物名は false', '室町綾小路ビル1階', false],
    ['F のあとが数字なら false（部屋の記号）', 'F104号', false],
    ['F のあとが英字なら false', 'FRONTIER NAGOYA', false],
    ['F のあとが棟なら false', 'F棟', false],
    ['数字で始まる階は false', '2階', false],
  ];
  for (const [name, after, expected] of cases) {
    it(name, () => {
      assert.equal(isLeftoverMark(after), expected);
    });
  }
});

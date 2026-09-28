import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { toBuilding } from '../../../src/domain/split/building.ts';

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

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { splitCandidates } from '../../../src/domain/split/candidates.ts';

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

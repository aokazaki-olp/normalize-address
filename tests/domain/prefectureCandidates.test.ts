import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { prefectureCandidates } from '../../src/domain/prefectureCandidates.ts';

describe('prefectureCandidates', () => {
  it('同じ名前の市で始まれば、都道府県の候補を返す', () => {
    assert.deepEqual(prefectureCandidates('府中市府中町一丁目12番地の7'), [
      '東京都',
      '広島県',
    ]);
  });

  it('候補が3つ以上の町も返す', () => {
    assert.deepEqual(prefectureCandidates('池田町1'), [
      '北海道',
      '福井県',
      '長野県',
      '岐阜県',
    ]);
  });

  it('先頭の空白を落として判定する', () => {
    assert.deepEqual(prefectureCandidates(' 府中市1'), ['東京都', '広島県']);
  });

  it('都道府県で始まれば空', () => {
    assert.deepEqual(
      prefectureCandidates('東京都府中市府中町一丁目12番地の7'),
      [],
    );
  });

  it('同じ名前の無い市で始まれば空', () => {
    assert.deepEqual(prefectureCandidates('渋谷区道玄坂一丁目2-3'), []);
  });
});

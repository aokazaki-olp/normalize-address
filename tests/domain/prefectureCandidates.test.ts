import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  bestCandidate,
  prefectureCandidates,
} from '../../src/domain/prefectureCandidates.ts';
import type { ParsedAddress } from '../../src/ports/addressParser.ts';

const parsed = (fields: Partial<ParsedAddress>): ParsedAddress => ({
  prefecture: null,
  city: null,
  town: null,
  block: null,
  unmatched: '',
  level: 3,
  point: null,
  lgCode: null,
  machiazaId: null,
  raw: {},
  ...fields,
});

const tried = (
  ...wholes: Partial<ParsedAddress>[]
): { text: string; whole: ParsedAddress }[] =>
  wholes.map((whole, i) => ({ text: String(i), whole: parsed(whole) }));

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

describe('bestCandidate', () => {
  it('level の高いものを選ぶ', () => {
    assert.equal(
      bestCandidate(tried({ level: 3 }, { level: 8, unmatched: 'ビル' }))?.text,
      '1',
    );
  });

  it('level が同じなら町字の長いものを選ぶ', () => {
    assert.equal(
      bestCandidate(tried({ town: '府中町' }, { town: '府中町一丁目' }))?.text,
      '1',
    );
  });

  it('level と町字の長さが同じなら unmatched の短いものを選ぶ', () => {
    assert.equal(
      bestCandidate(tried({ unmatched: '1-2' }, { unmatched: '1' }))?.text,
      '1',
    );
  });

  it('最も良いものが同点なら undefined', () => {
    assert.equal(
      bestCandidate(tried({ town: '東町' }, { level: 2 }, { town: '本町' })),
      undefined,
    );
  });

  it('候補が無ければ undefined', () => {
    assert.equal(bestCandidate(tried()), undefined);
  });

  it('候補が1つならそれを選ぶ', () => {
    assert.equal(bestCandidate(tried({ level: 1 }))?.text, '0');
  });
});

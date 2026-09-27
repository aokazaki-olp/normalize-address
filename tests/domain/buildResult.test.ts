import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildResult, styleField } from '../../src/domain/buildResult.ts';
import type { ParsedAddress } from '../../src/ports/addressParser.ts';

const WHOLE: ParsedAddress = {
  prefecture: '北海道',
  city: '札幌市中央区',
  town: '北一条西二丁目',
  number: '１',
  other: ' ビル',
  level: 8,
  point: { lat: 43, lng: 141, level: 8 },
  lgCode: '011011',
  machiazaId: '0001002',
  raw: { pref: '北海道' },
};

describe('styleField', () => {
  it('指定が無ければガード付き NFKC だけ', () => {
    assert.equal(styleField('town', '相生１号①', undefined), '相生1号①');
  });
  it('default を当てる', () => {
    assert.equal(
      styleField('number', '1-2', { default: { digit: 'full' } }),
      '１-２',
    );
  });
  it('項目ごとの指定を default にマージする', () => {
    assert.equal(
      styleField('number', '1-2', {
        default: { digit: 'full' },
        fields: { number: { symbol: 'full' } },
      }),
      '１－２',
    );
  });
  it('項目ごとの指定が false なら当てない', () => {
    assert.equal(
      styleField('number', '１-2', {
        default: { digit: 'full' },
        fields: { number: false },
      }),
      '1-2',
    );
  });
  it('ほかの項目の指定は当てない', () => {
    assert.equal(
      styleField('building', '1', { fields: { number: { digit: 'full' } } }),
      '1',
    );
  });
  it('字形の指定が検査を満たさなければ TypeError', () => {
    assert.throws(
      () => styleField('other', 'a', { default: { chars: { ab: 'x' } } }),
      TypeError,
    );
  });
});

describe('buildResult', () => {
  const outcome = {
    split: 'found',
    address: WHOLE,
    other: '',
    building: 'ビル１Ｆ',
  } as const;

  it('住所の項目は outcome.address、other と building は切れ目の探索の結果から取る', () => {
    assert.deepEqual(buildResult('入力', WHOLE, outcome, undefined), {
      input: '入力',
      prefecture: '北海道',
      city: '札幌市中央区',
      town: '北一条西二丁目',
      number: '1',
      building: 'ビル1F',
      other: '',
      level: 8,
      point: { lat: 43, lng: 141, level: 8 },
      split: 'found',
    });
  });
  it('無い項目は入れない', () => {
    const whole = { other: 'x', level: 0, raw: {} } as const;
    const result = buildResult(
      'x',
      whole,
      { split: 'skipped', address: whole, other: 'x', building: '' },
      undefined,
    );
    assert.deepEqual(result, {
      input: 'x',
      building: '',
      other: 'x',
      level: 0,
      split: 'skipped',
    });
  });
  it('codes と nja はオプションが true のときだけ入れる', () => {
    const result = buildResult('入力', WHOLE, outcome, {
      codes: true,
      nja: true,
    });
    assert.deepEqual(result.codes, { lgCode: '011011', machiazaId: '0001002' });
    assert.equal(result.nja, WHOLE.raw);
    const without = buildResult('入力', WHOLE, outcome, { codes: false });
    assert.equal('codes' in without, false);
    assert.equal('nja' in without, false);
  });
  it('コードが無ければ codes は空', () => {
    const whole = {
      other: '',
      level: 1,
      prefecture: '北海道',
      raw: {},
    } as const;
    const result = buildResult(
      'x',
      whole,
      { split: 'skipped', address: whole, other: '', building: '' },
      { codes: true },
    );
    assert.deepEqual(result.codes, {});
  });
  it('住所の項目・level・point・codes は前半の結果、nja は全体の結果から取る', () => {
    const front = {
      ...WHOLE,
      number: '1-2',
      level: 3,
      point: { lat: 1, lng: 2, level: 3 },
      lgCode: '011012',
      machiazaId: '0001003',
      raw: { front: true },
    } as const;
    const result = buildResult(
      '入力',
      WHOLE,
      { ...outcome, address: front, other: '9' },
      { codes: true, nja: true },
    );
    assert.equal(result.number, '1-2');
    assert.equal(result.level, 3);
    assert.deepEqual(result.point, { lat: 1, lng: 2, level: 3 });
    assert.deepEqual(result.codes, { lgCode: '011012', machiazaId: '0001003' });
    assert.equal(result.other, '9');
    assert.equal(result.nja, WHOLE.raw);
  });
  it('input には字形の指定を当てない', () => {
    const result = buildResult('１', WHOLE, outcome, {
      style: { default: { digit: 'full' } },
    });
    assert.equal(result.input, '１');
    assert.equal(result.number, '１');
    assert.equal(result.building, 'ビル１F');
  });
});

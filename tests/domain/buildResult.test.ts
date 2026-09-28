import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildResult, styleField } from '../../src/domain/buildResult.ts';
import { prepareOptions } from '../../src/domain/options.ts';
import type { ParsedAddress } from '../../src/ports/addressParser.ts';

const WHOLE: ParsedAddress = {
  prefecture: '北海道',
  city: '札幌市中央区',
  town: '北一条西二丁目',
  block: '１',
  unmatched: ' ビル',
  level: 8,
  point: { lat: 43, lng: 141, level: 8 },
  lgCode: '011011',
  machiazaId: '0001002',
  raw: { pref: '北海道' },
};

describe('styleField', () => {
  it('指定が無ければガード付き NFKC だけ', () => {
    assert.equal(styleField('相生１号①', undefined), '相生1号①');
  });
  it('ガード付き NFKC をかけてから指定を当てる', () => {
    assert.equal(styleField('１-2', { digit: 'full' }), '１-２');
  });
});

describe('buildResult', () => {
  const outcome = {
    split: 'found',
    fieldsFrom: WHOLE,
    unmatched: '',
    building: 'ビル１Ｆ',
  } as const;

  it('住所の項目は outcome.fieldsFrom、unmatched と building は切れ目の探索の結果から取る', () => {
    assert.deepEqual(
      buildResult('入力', WHOLE, outcome, prepareOptions(undefined)),
      {
        input: '入力',
        prefecture: '北海道',
        city: '札幌市中央区',
        town: '北一条西二丁目',
        block: '1',
        building: 'ビル1F',
        unmatched: '',
        level: 8,
        point: { lat: 43, lng: 141, level: 8 },
        split: 'found',
      },
    );
  });
  it('無い項目は null にする', () => {
    const whole: ParsedAddress = {
      prefecture: null,
      city: null,
      town: null,
      block: null,
      unmatched: 'x',
      level: 0,
      point: null,
      lgCode: null,
      machiazaId: null,
      raw: {},
    };
    const result = buildResult(
      'x',
      whole,
      { split: 'skipped', fieldsFrom: whole, unmatched: 'x', building: '' },
      prepareOptions(undefined),
    );
    assert.deepEqual(result, {
      input: 'x',
      prefecture: null,
      city: null,
      town: null,
      block: null,
      building: '',
      unmatched: 'x',
      level: 0,
      point: null,
      split: 'skipped',
    });
  });
  it('codes と nja はオプションが true のときだけ入れる', () => {
    const result = buildResult(
      '入力',
      WHOLE,
      outcome,
      prepareOptions({ codes: true, nja: true }),
    );
    assert.deepEqual(result.codes, { lgCode: '011011', machiazaId: '0001002' });
    assert.equal(result.nja, WHOLE.raw);
    const without = buildResult(
      '入力',
      WHOLE,
      outcome,
      prepareOptions({ codes: false }),
    );
    assert.equal('codes' in without, false);
    assert.equal('nja' in without, false);
  });
  it('コードが無ければ codes の中身は null', () => {
    const whole: ParsedAddress = {
      prefecture: '北海道',
      city: null,
      town: null,
      block: null,
      unmatched: '',
      level: 1,
      point: null,
      lgCode: null,
      machiazaId: null,
      raw: {},
    };
    const result = buildResult(
      'x',
      whole,
      { split: 'skipped', fieldsFrom: whole, unmatched: '', building: '' },
      prepareOptions({ codes: true }),
    );
    assert.deepEqual(result.codes, { lgCode: null, machiazaId: null });
  });
  it('住所の項目・level・point・codes は前半の結果、nja は全体の結果から取る', () => {
    const front = {
      ...WHOLE,
      block: '1-2',
      level: 3,
      point: { lat: 1, lng: 2, level: 3 },
      lgCode: '011012',
      machiazaId: '0001003',
      raw: { front: true },
    } as const;
    const result = buildResult(
      '入力',
      WHOLE,
      { ...outcome, fieldsFrom: front, unmatched: '9' },
      prepareOptions({ codes: true, nja: true }),
    );
    assert.equal(result.block, '1-2');
    assert.equal(result.level, 3);
    assert.deepEqual(result.point, { lat: 1, lng: 2, level: 3 });
    assert.deepEqual(result.codes, { lgCode: '011012', machiazaId: '0001003' });
    assert.equal(result.unmatched, '9');
    assert.equal(result.nja, WHOLE.raw);
  });
  it('input には字形の指定を当てない', () => {
    const result = buildResult(
      '１',
      WHOLE,
      outcome,
      prepareOptions({ style: { default: { digit: 'full' } } }),
    );
    assert.equal(result.input, '１');
    assert.equal(result.block, '１');
    assert.equal(result.building, 'ビル１F');
  });
});

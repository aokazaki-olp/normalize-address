import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyCharStyle } from '@arihirookazaki/normalize-core';

import { prepareOptions } from '../../src/domain/options.ts';
import type { AddressNormalizerOptions } from '../../src/ports/addressResult.ts';

const styled = (
  field: 'number' | 'building' | 'other',
  text: string,
  options: AddressNormalizerOptions | undefined,
): string => {
  const style = prepareOptions(options).styles[field];
  return style === undefined ? text : applyCharStyle(text, style);
};

describe('prepareOptions', () => {
  it('指定が無ければ、どの項目の指定も空で、nja と codes は false', () => {
    const prepared = prepareOptions(undefined);
    assert.deepEqual(prepared, prepareOptions({}));
    assert.equal(prepared.nja, false);
    assert.equal(prepared.codes, false);
    assert.deepEqual(prepared.styles.prefecture, {});
    assert.deepEqual(prepared.styles.other, {});
  });
  it('default を当てる', () => {
    assert.equal(
      styled('number', '1-2', { style: { default: { digit: 'full' } } }),
      '１-２',
    );
  });
  it('項目ごとの指定を default にマージする', () => {
    assert.equal(
      styled('number', '1-2', {
        style: {
          default: { digit: 'full' },
          fields: { number: { symbol: 'full' } },
        },
      }),
      '１－２',
    );
  });
  it('項目ごとの指定が false なら当てない', () => {
    const prepared = prepareOptions({
      style: { default: { digit: 'full' }, fields: { number: false } },
    });
    assert.equal(prepared.styles.number, undefined);
    assert.deepEqual(prepared.styles.town, { digit: 'full' });
  });
  it('項目ごとの指定が undefined なら default だけ', () => {
    assert.equal(
      styled('number', '1', {
        style: { default: { digit: 'full' }, fields: { number: undefined } },
      }),
      '１',
    );
  });
  it('ほかの項目の指定は当てない', () => {
    assert.equal(
      styled('building', '1', {
        style: { fields: { number: { digit: 'full' } } },
      }),
      '1',
    );
  });
  it('nja と codes を boolean にそろえる', () => {
    const prepared = prepareOptions({ nja: true, codes: false });
    assert.equal(prepared.nja, true);
    assert.equal(prepared.codes, false);
  });

  describe('検査を満たさなければ TypeError', () => {
    const invalid: [string, unknown][] = [
      ['options が null', null],
      ['options が文字列', 'codes'],
      ['options が配列', []],
      ['nja が boolean でない', { nja: 'true' }],
      ['codes が boolean でない', { codes: 1 }],
      ['style が object でない', { style: 'full' }],
      ['style が null', { style: null }],
      ['style.default が object でない', { style: { default: 'full' } }],
      ['style.default が null', { style: { default: null } }],
      ['style.fields が object でない', { style: { fields: [] } }],
      [
        'style.fields のキーが項目でない',
        { style: { fields: { street: {} } } },
      ],
      [
        'style.fields の値が object でも false でもない',
        { style: { fields: { number: true } } },
      ],
      [
        'default の指定が検査を満たさない',
        { style: { default: { chars: { ab: 'x' } } } },
      ],
      [
        'default の指定のクラスが half・full でない',
        { style: { default: { digit: 'wide' } } },
      ],
      [
        '項目ごとの指定が検査を満たさない',
        { style: { fields: { other: { chars: { ab: 'x' } } } } },
      ],
    ];
    for (const [name, options] of invalid) {
      it(name, () => {
        assert.throws(
          () => prepareOptions(options as AddressNormalizerOptions),
          TypeError,
        );
      });
    }
  });
});

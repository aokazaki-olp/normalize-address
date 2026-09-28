import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as publicApi from '../src/index.ts';

describe('公開面', () => {
  it('AddressNormalizer と NormalizeAddressError だけを値として公開する', () => {
    assert.deepEqual(Object.keys(publicApi).toSorted(), [
      'AddressNormalizer',
      'NormalizeAddressError',
    ]);
    assert.deepEqual(Object.keys(publicApi.AddressNormalizer), ['create']);
  });

  it('AddressLevel と AddressPoint を型として公開する', () => {
    const level: publicApi.AddressLevel = 8;
    const point: publicApi.AddressPoint = { lat: 35, lng: 139, level };
    assert.deepEqual(point, { lat: 35, lng: 139, level: 8 });
  });

  it('字形の指定が検査を満たさなければ、create が TypeError を投げる（normalize を呼ばなくても分かる）', () => {
    assert.throws(
      () =>
        publicApi.AddressNormalizer.create({
          style: { default: { chars: { ab: 'x' } } },
        }),
      TypeError,
    );
  });

  for (const field of ['number', 'other']) {
    it(`style.fields のキーが旧名の ${field} なら、create が TypeError を投げる`, () => {
      assert.throws(
        () =>
          publicApi.AddressNormalizer.create({
            style: { fields: { [field]: {} } },
          }),
        (error) => {
          assert.ok(error instanceof TypeError);
          assert.match(error.message, new RegExp(`: ${field}$`, 'u'));
          return true;
        },
      );
    });
  }

  it('options が object でなければ、create が TypeError を投げる', () => {
    assert.throws(
      () =>
        publicApi.AddressNormalizer.create(
          'codes' as unknown as publicApi.AddressNormalizerOptions,
        ),
      TypeError,
    );
  });

  it('input が文字列でなければ TypeError（NJA を呼ばない）', async () => {
    const normalizer = publicApi.AddressNormalizer.create();
    await assert.rejects(
      normalizer.normalize(1 as unknown as string),
      TypeError,
    );
  });
});

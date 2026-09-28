import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as publicApi from '../src/index.ts';

describe('公開面', () => {
  it('normalizeAddress と NormalizeAddressError だけを値として公開する', () => {
    assert.deepEqual(Object.keys(publicApi).toSorted(), [
      'NormalizeAddressError',
      'normalizeAddress',
    ]);
  });

  it('input が文字列でなければ TypeError（NJA を呼ばない）', async () => {
    await assert.rejects(
      publicApi.normalizeAddress(1 as unknown as string),
      TypeError,
    );
  });
});

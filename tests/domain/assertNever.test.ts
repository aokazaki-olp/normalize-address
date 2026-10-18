import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { assertNever } from '../../src/domain/assertNever.ts';

describe('assertNever', () => {
  it('呼ばれたら値を添えて投げる', () => {
    assert.throws(() => assertNever('zz' as never), {
      name: 'Error',
      message: '想定していない値: zz',
    });
  });
});

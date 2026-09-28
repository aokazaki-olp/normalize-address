import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { wholeTail } from '../../../src/domain/split/addressTail.ts';
import type { ParsedAddress } from '../../../src/ports/addressParser.ts';

const parsed = (fields: Partial<ParsedAddress>): ParsedAddress => ({
  unmatched: '',
  level: 3,
  raw: {},
  ...fields,
});

describe('wholeTail', () => {
  it('level 8 は block が末尾で unmatched が残り', () => {
    assert.deepEqual(
      wholeTail(parsed({ level: 8, block: '2-3', unmatched: ' タワ-12F' })),
      { tail: '2-3', rest: ' タワ-12F' },
    );
  });
  it('level 8 で unmatched の先頭の号は残りから除く', () => {
    assert.deepEqual(
      wholeTail(parsed({ level: 8, block: '3-21-5', unmatched: '号' })),
      { tail: '3-21-5', rest: '' },
    );
    assert.deepEqual(
      wholeTail(parsed({ level: 8, block: '4-8', unmatched: '番地ビル' })),
      { tail: '4-8', rest: 'ビル' },
    );
  });
  it('番先・地先・番地先も接尾語として除く', () => {
    assert.deepEqual(
      wholeTail(parsed({ level: 8, block: '6', unmatched: '番先6街区' })),
      { tail: '6', rest: '6街区' },
    );
    assert.deepEqual(wholeTail(parsed({ unmatched: '4番地先数寄屋' })), {
      tail: '4',
      rest: '数寄屋',
    });
  });
  it('level 8 で先頭の号を除くのは1回だけ', () => {
    assert.deepEqual(
      wholeTail(parsed({ level: 8, block: '1-9', unmatched: '号地下1階' })),
      { tail: '1-9', rest: '地下1階' },
    );
  });
  it('level 3 は unmatched の先頭の番地らしい部分が末尾', () => {
    assert.deepEqual(wholeTail(parsed({ unmatched: '12-3-4 ビル5F' })), {
      tail: '12-3-4',
      rest: ' ビル5F',
    });
  });
  it('level 3 で番地らしい部分が無ければ末尾は空', () => {
    assert.deepEqual(wholeTail(parsed({ unmatched: 'ビル' })), {
      tail: '',
      rest: 'ビル',
    });
  });
  it('level 3 で番地らしい部分の直後の号は残りから除く', () => {
    assert.deepEqual(wholeTail(parsed({ unmatched: '5-15-2号' })), {
      tail: '5-15-2',
      rest: '',
    });
    assert.deepEqual(wholeTail(parsed({ unmatched: '28-9号2階' })), {
      tail: '28-9',
      rest: '2階',
    });
  });
  it('level 3 で番地らしい部分の直後の番地は最長一致で除く', () => {
    assert.deepEqual(wholeTail(parsed({ unmatched: '1番地ビル' })), {
      tail: '1',
      rest: 'ビル',
    });
  });
  it('番地らしい部分が無ければ号を除かない', () => {
    assert.deepEqual(wholeTail(parsed({ unmatched: '号室' })), {
      tail: '',
      rest: '号室',
    });
  });
  it('末尾のハイフンは番地に含めない', () => {
    assert.deepEqual(wholeTail(parsed({ unmatched: '1-2-' })), {
      tail: '1-2',
      rest: '-',
    });
  });
});

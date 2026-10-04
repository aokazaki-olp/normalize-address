import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addressNumbers,
  exceedsNumberLimit,
  frontTail,
  isThirdLot,
  spacedFloorDigits,
  wholeContext,
  wholeTail,
} from '../../../src/domain/split/addressTail.ts';
import type { ParsedAddress } from '../../../src/ports/addressParser.ts';

const parsed = (fields: Partial<ParsedAddress>): ParsedAddress =>
  Object.assign(
    {
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
    } satisfies ParsedAddress,
    fields,
  );

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
  it('level 3 で NJA が残した番地の形は、区切りを - にそろえて枝番まで末尾にする', () => {
    assert.deepEqual(wholeTail(parsed({ unmatched: '43ノ2' })), {
      tail: '43-2',
      rest: '',
    });
    assert.deepEqual(
      wholeTail(parsed({ unmatched: '25番-5-1バティマE3階 301号室' })),
      { tail: '25-5-1', rest: 'バティマE3階 301号室' },
    );
  });
  it('level 3 で号の後ろの数字は末尾に入れない', () => {
    assert.deepEqual(wholeTail(parsed({ unmatched: '103号2F E1区画' })), {
      tail: '103',
      rest: '2F E1区画',
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

describe('addressNumbers', () => {
  it('3つ目の番号が3桁以上なら、2つまでを住所の番号にする', () => {
    assert.equal(addressNumbers('3-1-211', ''), '3-1');
    assert.equal(addressNumbers('3-1-1201', ''), '3-1');
  });
  it('3つ目の番号が1〜2桁なら住所の番号に残し、4つ目からは外す', () => {
    assert.equal(addressNumbers('3-1-12', ''), '3-1-12');
    assert.equal(addressNumbers('3-1-2', ''), '3-1-2');
    assert.equal(addressNumbers('3-1-2-405', ''), '3-1-2');
  });
  it('ブロック地番の街区の番号は数に入れない', () => {
    assert.equal(addressNumbers('87区654-3', ''), '87区654-3');
    assert.equal(addressNumbers('87区654-3-201', ''), '87区654-3');
  });
  it('階・部屋の印が続く最後の番号は住所の番号にしない', () => {
    assert.equal(addressNumbers('5番-3', 'F'), '5');
    assert.equal(addressNumbers('5番-101', '号室'), '5');
    assert.equal(addressNumbers('5番-3', 'FKハイツ'), '5番-3');
  });
  it('番号が1つなら、印が続いても住所の番号にする', () => {
    assert.equal(addressNumbers('5', 'F'), '5');
  });
});

describe('isThirdLot', () => {
  const cases: [string, string, string, boolean][] = [
    [
      'の・番地の でつながる3つ目',
      '架空町12の345番地の678',
      '12-345-678',
      true,
    ],
    ['ノ でつながる3つ目', '架空町12ノ345ノ678', '12-345-678', true],
    ['横棒でつながる3つ目', '架空町12-345-678', '12-345-678', false],
    ['番のあと横棒でつながる3つ目', '架空町12番345-678', '12-345-678', false],
    [
      'の のあと横棒でつながる3つ目',
      '架空町12の345-678号室',
      '12-345-678',
      false,
    ],
    ['番号が2つだけ', '架空町12の345', '12-345', false],
    [
      '漢数字の番号も同じ値として読む',
      '架空町十二の三百四十五の六七八',
      '12-345-678',
      true,
    ],
    ['元のテキストに同じ並びが無い', '架空町99の1の2', '12-345-678', false],
    [
      '町字に最も近い並びを見る（後ろの建物部の並びを見ない）',
      '架空町12-345-678 ビル12の345の678',
      '12-345-678',
      false,
    ],
    [
      '町字に最も近い並びを見る（後ろの横棒の並びを見ない）',
      '架空町12の345の678 12-345-678',
      '12-345-678',
      true,
    ],
  ];
  for (const [name, text, numberPart, expected] of cases) {
    it(name, () => {
      assert.equal(isThirdLot(text, numberPart), expected);
    });
  }
});

describe('spacedFloorDigits', () => {
  it('最後の番号が空白をはさんで階の数字に続くなら、階の桁数を返す', () => {
    assert.equal(spacedFloorDigits('架空町87番地13 4F', '87-134'), 1);
    assert.equal(spacedFloorDigits('架空町87番地13 12階', '87-1312'), 2);
  });
  it('空白をはさまないなら 0', () => {
    assert.equal(spacedFloorDigits('架空町87番地134F', '87-134'), 0);
  });
});

describe('wholeContext', () => {
  it('空白のあとの階の数字だけを外し、支号は住所の末尾に残す', () => {
    const context = wholeContext(
      parsed({ unmatched: '87-134F' }),
      '架空町87番地13 4F',
    );
    assert.equal(context.tail, '87-13');
    assert.equal(context.rest, '4F');
  });
  it('漢数字で書いた3つ目も の でつながるなら住所の末尾に残す', () => {
    const context = wholeContext(
      parsed({ unmatched: '340-12-500' }),
      '架空町三百四十の十二の五百',
    );
    assert.equal(context.tail, '340-12-500');
    assert.equal(context.rest, '');
  });
  it('3つ目が の でつながるなら、3桁以上でも住所の末尾に残す', () => {
    const context = wholeContext(
      parsed({ unmatched: '12-345-678' }),
      '架空町12の345番地の678',
    );
    assert.equal(context.thirdIsLot, true);
    assert.equal(context.tail, '12-345-678');
    assert.equal(context.rest, '');
  });
  it('3つ目が横棒でつながるなら、3桁以上は住所の末尾にしない', () => {
    const context = wholeContext(
      parsed({ unmatched: '12-345-678' }),
      '架空町12-345-678',
    );
    assert.equal(context.thirdIsLot, false);
    assert.equal(context.tail, '12-345');
    assert.equal(context.rest, '-678');
  });
});

describe('addressNumbers（空白のあとの階の数字）', () => {
  it('階の数字を外したあとも、番号の上限を当てる', () => {
    assert.equal(addressNumbers('1-2-3-45', 'F', false, 1), '1-2-3');
    assert.equal(addressNumbers('12-345-6789', 'F', false, 1), '12-345');
  });
  it('階の数字を外して2つになるなら、そのまま住所の番号にする', () => {
    assert.equal(addressNumbers('87-134', 'F', false, 1), '87-13');
  });
});

describe('長い入力', () => {
  it('数千字の番号の並びでも短い時間で返す', () => {
    const start = performance.now();
    addressNumbers(`${'1-'.repeat(3000)}1`, 'F', false, 1);
    isThirdLot(`架空町${'1の'.repeat(3000)}`, `${'1-'.repeat(2999)}1`);
    spacedFloorDigits(`${'1'.repeat(5000)} ${'1'.repeat(5000)}x`, '1');
    wholeContext(parsed({ unmatched: `${'1番の'.repeat(3000)}x` }), '');
    assert.ok(performance.now() - start < 500);
  });
});

describe('exceedsNumberLimit', () => {
  it('3つ目が の でつながるなら上限を超えない', () => {
    assert.equal(
      exceedsNumberLimit(parsed({ unmatched: '12-345-678' }), ' ビル', true),
      false,
    );
  });

  it('level 3 の前半の番号が上限を超えれば true', () => {
    assert.equal(
      exceedsNumberLimit(parsed({ unmatched: '3-1-211' }), ' ビル'),
      true,
    );
  });
  it('前半の後ろが階の印で始まれば、最後の番号を数えない', () => {
    assert.equal(exceedsNumberLimit(parsed({ unmatched: '5-3' }), '階'), true);
    assert.equal(
      exceedsNumberLimit(parsed({ unmatched: '5-3' }), ' 2階'),
      false,
    );
  });
  it('level 8 の前半は false', () => {
    assert.equal(
      exceedsNumberLimit(
        parsed({ block: '3-1', unmatched: '', level: 8 }),
        '-211',
      ),
      false,
    );
  });
});

describe('frontTail', () => {
  it('前半の unmatched の番地の形は、区切りを - にそろえる', () => {
    assert.equal(frontTail(parsed({ unmatched: '17番の2' })), '17-2');
  });
  it('block と、末尾の接尾語を落とした unmatched をつなぐ', () => {
    assert.equal(
      frontTail(parsed({ block: '6', unmatched: '番先', level: 8 })),
      '6',
    );
    assert.equal(frontTail(parsed({ unmatched: '28-9号' })), '28-9');
  });
  it('号の後ろの数字はそろえない', () => {
    assert.equal(frontTail(parsed({ unmatched: '16号7' })), '16号7');
  });
});

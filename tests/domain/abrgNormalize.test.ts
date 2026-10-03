import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { guardedNfkc } from '@arihirookazaki/normalize-core';
import {
  addressNumbersToHyphen,
  addSpaceAfterFirstArabicNumber,
  addSpaceAfterNumberBeforeJapanese,
  addSpacesAroundPunctuation,
  basicNormalize,
  detectAddressType,
  normalizeBasicNormalized,
  normalizeDashes,
  normalizeSpaces,
} from '../../src/domain/abrgNormalize.ts';
import { trackText, type TrackedText } from '../../src/domain/trackedText.ts';
import {
  ADD_SPACE_AFTER_FIRST_ARABIC_NUMBER_CASES,
  ADD_SPACE_AFTER_NUMBER_BEFORE_JAPANESE_CASES,
  ADDRESS_NUMBERS_TO_HYPHEN_CASES,
  BASIC_NORMALIZE_CASES,
  DETECT_ADDRESS_TYPE_CASES,
  NORMALIZE_ADDRESS_TEXT_CASES,
  NORMALIZE_DASHES_CASES,
  type StringCase,
} from './abrgNormalizeCases.ts';

// 移植していない前処理（引用符・コメント・異体字セレクタの除去）に頼るもの
const NOT_PORTED: Record<string, string> = {
  'normalize_test.go TestNormalizeAddressText L17': 'コメントの除去',
  'normalize_test.go TestNormalizeAddressText L23': 'コメントの除去',
  'normalize_test.go TestNormalizeAddressText L145': 'コメントの除去',
  'normalize_test.go TestNormalizeAddressText L177': 'コメントの除去',
  'pipeline_test.go TestBasicNormalize L21': '引用符の除去',
  'pipeline_test.go TestBasicNormalize L26': '異体字セレクタの除去',
  'pipeline_test.go TestBasicNormalize L41': 'コメントの除去',
  'pipeline_test.go TestBasicNormalize L67': '引用符の除去',
  'pipeline_test.go TestBasicNormalize L72': 'コメントの除去',
  'pipeline_test.go TestBasicNormalize_Pipeline L94': '引用符の除去',
};

const todoOf = (source: string): { todo?: string } => {
  const reason = NOT_PORTED[source];
  return reason === undefined ? {} : { todo: `移植していない：${reason}` };
};

const checkOriginsAreOrdered = (tracked: TrackedText, input: string): void => {
  assert.equal(tracked.origins.length, tracked.text.length);
  let last = -1;
  for (const [i, origin] of tracked.origins.entries()) {
    if (origin < 0) {
      continue;
    }
    assert.ok(origin > last, '元の位置が増える順に並ぶ');
    last = origin;
    const char = tracked.text.charAt(i);
    assert.ok(char === input.charAt(origin) || char === ' ' || char === '-');
  }
};

const describeStringCases = (
  title: string,
  cases: StringCase[],
  transform: (tracked: TrackedText) => TrackedText,
): void => {
  describe(title, () => {
    for (const { source, name, input, expected, changed } of cases) {
      it(`${source} ${name}`, todoOf(source), () => {
        const result = transform(trackText(input));
        assert.equal(result.text, expected);
        if (changed !== undefined) {
          assert.equal(result.text !== input, changed);
        }
        checkOriginsAreOrdered(result, input);
      });
    }
  });
};

describeStringCases('normalizeDashes', NORMALIZE_DASHES_CASES, normalizeDashes);

describeStringCases(
  'addressNumbersToHyphen',
  ADDRESS_NUMBERS_TO_HYPHEN_CASES,
  addressNumbersToHyphen,
);

describeStringCases(
  'addSpaceAfterFirstArabicNumber',
  ADD_SPACE_AFTER_FIRST_ARABIC_NUMBER_CASES,
  addSpaceAfterFirstArabicNumber,
);

describeStringCases(
  'addSpaceAfterNumberBeforeJapanese',
  ADD_SPACE_AFTER_NUMBER_BEFORE_JAPANESE_CASES,
  addSpaceAfterNumberBeforeJapanese,
);

describe('detectAddressType', () => {
  for (const { source, name, input, expected } of DETECT_ADDRESS_TYPE_CASES) {
    it(`${source} ${name}`, () => {
      assert.equal(detectAddressType(input), expected);
    });
  }
});

describe('basicNormalize（ガード付き NFKC の後）', () => {
  for (const { source, name, input, expected } of BASIC_NORMALIZE_CASES) {
    it(`${source} ${name}`, todoOf(source), () => {
      const text = guardedNfkc(input);
      assert.equal(basicNormalize(trackText(text)).text, expected);
    });
  }
});

describe('normalizeBasicNormalized（ガード付き NFKC と basicNormalize の後）', () => {
  for (const {
    source,
    name,
    input,
    expected,
    addressType,
  } of NORMALIZE_ADDRESS_TEXT_CASES) {
    it(`${source} ${name}`, todoOf(source), () => {
      const text = guardedNfkc(input);
      const result = normalizeBasicNormalized(basicNormalize(trackText(text)));
      assert.equal(result.text.text, expected);
      assert.equal(result.addressType, addressType);
      checkOriginsAreOrdered(result.text, text);
    });
  }
});

describe('元の位置の追跡', () => {
  it('normalizeSpaces は続いた空白の最初の位置を残す', () => {
    const result = normalizeSpaces(trackText(' a\u3000 b '));
    assert.equal(result.text, 'a b');
    assert.deepEqual(result.origins, [1, 2, 4]);
  });

  it('normalizeDashes は長さを変えず、数字に挟まれた「ー」だけを変える', () => {
    const result = normalizeDashes(trackText('1ー2ー3 ータ\u2015'));
    assert.equal(result.text, '1-2-3 ータ-');
    assert.deepEqual(
      result.origins.filter((origin) => origin >= 0),
      [0, 2, 4, 5, 6, 7, 8],
    );
  });

  it('addSpacesAroundPunctuation は挿入した空白を -1 にする', () => {
    const result = addSpacesAroundPunctuation(trackText('a(b)c、d'));
    assert.equal(result.text, 'a (b) c 、d');
    assert.deepEqual(result.origins, [0, -1, 1, 2, 3, -1, 4, -1, 5, 6]);
  });

  it('番号の後ろの建物名は元の位置を保つ', () => {
    const result = addressNumbersToHyphen(trackText('1番2号ビル'));
    assert.equal(result.text, '1-2 ビル');
    assert.deepEqual(result.origins, [0, -1, 2, -1, 4, 5]);
  });
});

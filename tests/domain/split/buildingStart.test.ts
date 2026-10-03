import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildingStarts,
  toTextStart,
} from '../../../src/domain/split/buildingStart.ts';
import {
  concatTracked,
  insertedText,
  trackText,
} from '../../../src/domain/trackedText.ts';

describe('buildingStarts', () => {
  const at = (text: string, part: string): number[] => [text.indexOf(part)];
  const cases: [string, string, number[]][] = [
    [
      'abr-geocoder の規則で番地の後ろに入る空白',
      '札幌市中央区南3条西3丁目10番地三信ビル4階',
      at('札幌市中央区南3条西3丁目10番地三信ビル4階', '三信'),
    ],
    [
      '利用者が入れた空白（前半は空白を含めない）',
      '稲城市向陽台六丁目2番地1 1階',
      at('稲城市向陽台六丁目2番地1 1階', ' 1階'),
    ],
    [
      '号の後ろ（号は前半に残す）',
      '東京都千代田区紀尾井町1番3号番町YMビル',
      at('東京都千代田区紀尾井町1番3号番町YMビル', '番町Y'),
    ],
    [
      '部屋番号の前のハイフンは前半に含めない',
      '東京都千代田区三崎町三丁目2番6-1104号室レジディア水道橋',
      at('東京都千代田区三崎町三丁目2番6-1104号室レジディア水道橋', '-1104'),
    ],
    [
      '括弧の前',
      '神戸市東灘区向洋町中1-14(イーストコート2番街)',
      at('神戸市東灘区向洋町中1-14(イーストコート2番街)', '('),
    ],
    [
      '独自の規則：3つ以上の番号の後ろの -N号室',
      '福岡県福岡市中央区清川2-12-4-102号室',
      at('福岡県福岡市中央区清川2-12-4-102号室', '-102'),
    ],
    [
      '独自の規則：横棒は置き換えた写しで判定し、元の位置で返す',
      '福岡県福岡市中央区清川2―12―4―102室',
      at('福岡県福岡市中央区清川2―12―4―102室', '―102'),
    ],
    ['2つの番号の後ろの号室には独自の規則を当てない', '清川12-4-102号室', []],
    ['最初の算用数字より前の空白は使わない', '東京都 千代田区 紀尾井町', []],
    ['読点の前に入る空白は数字より前', '東京都港区、六本木1-2-3', []],
    ['住所で終わる', '東京都千代田区紀尾井町1番3号', []],
    [
      '独自の規則：数字に挟まれた長音の区切りでも、元の長音の位置で返す',
      '福岡県福岡市中央区清川2ー12ー4ー102号室',
      at('福岡県福岡市中央区清川2ー12ー4ー102号室', 'ー102'),
    ],
    ['空文字', '', []],
  ];
  for (const [name, text, expected] of cases) {
    it(name, () => {
      assert.deepEqual(buildingStarts(text), expected);
    });
  }
});

describe('toTextStart', () => {
  it('空白の後ろが長くても RangeError にならない', () => {
    const text = `坂1 ${'ビ'.repeat(200000)}`;
    const tracked = trackText(text);
    assert.equal(toTextStart(text, tracked, tracked, 2), 2);
  });
  it('空白の後ろが挿入した字だけなら使わない', () => {
    const text = '坂1ビル';
    const prepared = trackText(text);
    const formatted = concatTracked(
      trackText('坂1'),
      insertedText(' '),
      insertedText('-'),
    );
    assert.equal(toTextStart(text, prepared, formatted, 2), undefined);
  });
});

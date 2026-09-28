import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  concatTracked,
  insertTracked,
  insertedText,
  replaceTracked,
  sliceTracked,
  trackText,
  type TrackedText,
} from '../../src/domain/trackedText.ts';

const plain = (tracked: TrackedText): [string, number[]] => [
  tracked.text,
  [...tracked.origins],
];

describe('trackText', () => {
  it('各字の位置は自分の位置', () => {
    assert.deepEqual(plain(trackText('東京1')), ['東京1', [0, 1, 2]]);
  });
  it('空文字', () => {
    assert.deepEqual(plain(trackText('')), ['', []]);
  });
});

describe('insertedText', () => {
  it('各字の位置は -1', () => {
    assert.deepEqual(plain(insertedText('- ')), ['- ', [-1, -1]]);
  });
  it('空文字', () => {
    assert.deepEqual(plain(insertedText('')), ['', []]);
  });
});

describe('sliceTracked', () => {
  const tracked = trackText('abcde');
  it('開始と終了の間を取り出し、元の位置を保つ', () => {
    assert.deepEqual(plain(sliceTracked(tracked, 1, 3)), ['bc', [1, 2]]);
  });
  it('終了を省略すると末尾まで', () => {
    assert.deepEqual(plain(sliceTracked(tracked, 3)), ['de', [3, 4]]);
  });
  it('開始と終了が同じなら空', () => {
    assert.deepEqual(plain(sliceTracked(tracked, 2, 2)), ['', []]);
  });
});

describe('concatTracked', () => {
  it('文字列と位置をつなぐ', () => {
    const tracked = trackText('abc');
    assert.deepEqual(
      plain(
        concatTracked(
          sliceTracked(tracked, 0, 1),
          insertedText('-'),
          sliceTracked(tracked, 2),
        ),
      ),
      ['a-c', [0, -1, 2]],
    );
  });
  it('何も渡さなければ空', () => {
    assert.deepEqual(plain(concatTracked()), ['', []]);
  });
});

describe('replaceTracked', () => {
  it('$n はグループに当たった字で、元の位置を保つ', () => {
    const replaced = replaceTracked(
      trackText('1番2号'),
      /([0-9])番([0-9])号/dgu,
      '$1-$2',
    );
    assert.deepEqual(plain(replaced), ['1-2', [0, -1, 2]]);
  });
  it('テンプレートの $n 以外の字は挿入した字として扱う', () => {
    const replaced = replaceTracked(trackText('a1'), /([0-9])/dgu, ' $1 ');
    assert.deepEqual(plain(replaced), ['a 1 ', [0, -1, 1, -1]]);
  });
  it('当たらなかったグループは空', () => {
    const replaced = replaceTracked(trackText('xb'), /(a)|(b)/dgu, '[$1$2]');
    assert.deepEqual(plain(replaced), ['x[b]', [0, -1, 1, -1]]);
  });
  it('当たった部分をすべて置き換える', () => {
    const replaced = replaceTracked(trackText('a-b-c'), /-/dgu, '');
    assert.deepEqual(plain(replaced), ['abc', [0, 2, 4]]);
  });
  it('当たらなければ渡したものをそのまま返す', () => {
    const tracked = trackText('abc');
    assert.equal(replaceTracked(tracked, /x/dgu, 'y'), tracked);
  });
  it('d のフラグが無ければ TypeError', () => {
    assert.throws(() => replaceTracked(trackText('abc'), /b/gu, 'x'), {
      name: 'TypeError',
      message: 'pattern には d のフラグを指定してください',
    });
  });
});

describe('insertTracked', () => {
  const tracked = trackText('ab');
  it('指定した位置に挿入した字として入れる', () => {
    assert.deepEqual(plain(insertTracked(tracked, 1, ' ')), [
      'a b',
      [0, -1, 1],
    ]);
  });
  it('先頭に挿入する', () => {
    assert.deepEqual(plain(insertTracked(tracked, 0, '-')), [
      '-ab',
      [-1, 0, 1],
    ]);
  });
  it('末尾に挿入する', () => {
    assert.deepEqual(plain(insertTracked(tracked, 2, '-')), [
      'ab-',
      [0, 1, -1],
    ]);
  });
});

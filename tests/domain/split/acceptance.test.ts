import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isAddressFront,
  isSameAddress,
} from '../../../src/domain/split/acceptance.ts';
import { wholeContext } from '../../../src/domain/split/addressTail.ts';
import { toBuilding } from '../../../src/domain/split/building.ts';
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

describe('isSameAddress', () => {
  const whole = parsed({
    prefecture: '東京都',
    city: '渋谷区',
    town: '道玄坂一丁目',
    block: '2-3',
    level: 8,
  });
  const cases: [string, Partial<ParsedAddress>, string, boolean][] = [
    [
      'block が一致',
      {
        prefecture: '東京都',
        city: '渋谷区',
        town: '道玄坂一丁目',
        block: '2-3',
      },
      '2-3',
      true,
    ],
    [
      'block が無く unmatched が一致',
      {
        prefecture: '東京都',
        city: '渋谷区',
        town: '道玄坂一丁目',
        unmatched: '2-3',
      },
      '2-3',
      true,
    ],
    [
      'block と unmatched を - でつなぐ',
      {
        prefecture: '東京都',
        city: '渋谷区',
        town: '道玄坂一丁目',
        block: '2',
        unmatched: '3',
      },
      '2-3',
      true,
    ],
    [
      'unmatched の末尾の号を落として一致',
      {
        prefecture: '東京都',
        city: '渋谷区',
        town: '道玄坂一丁目',
        unmatched: '2-3号',
      },
      '2-3',
      true,
    ],
    [
      'block と、末尾の番地を落とした unmatched をつなぐ',
      {
        prefecture: '東京都',
        city: '渋谷区',
        town: '道玄坂一丁目',
        block: '2',
        unmatched: '3番地',
      },
      '2-3',
      true,
    ],
    [
      '号だけの unmatched は落として block と比べる',
      {
        prefecture: '東京都',
        city: '渋谷区',
        town: '道玄坂一丁目',
        block: '2-3',
        unmatched: '号',
      },
      '2-3',
      true,
    ],
    [
      '住所の末尾が違う',
      {
        prefecture: '東京都',
        city: '渋谷区',
        town: '道玄坂一丁目',
        block: '2',
      },
      '2-3',
      false,
    ],
    [
      '町字が違う',
      {
        prefecture: '東京都',
        city: '渋谷区',
        town: '道玄坂二丁目',
        block: '2-3',
      },
      '2-3',
      false,
    ],
    [
      '市区町村が違う',
      {
        prefecture: '東京都',
        city: '港区',
        town: '道玄坂一丁目',
        block: '2-3',
      },
      '2-3',
      false,
    ],
    [
      '都道府県が違う',
      { city: '渋谷区', town: '道玄坂一丁目', block: '2-3' },
      '2-3',
      false,
    ],
    [
      '末尾が空どうし',
      { prefecture: '東京都', city: '渋谷区', town: '道玄坂一丁目' },
      '',
      true,
    ],
  ];
  for (const [name, front, tail, expected] of cases) {
    it(name, () => {
      assert.equal(
        isSameAddress({ ...wholeContext(whole), tail }, parsed(front)),
        expected,
      );
    });
  }
});

describe('isAddressFront', () => {
  const area = {
    prefecture: '北海道',
    city: '札幌市中央区',
    town: '南三条西三丁目',
  };
  const level3 = parsed({ ...area, unmatched: '10-3信ビル4階' });
  const level8 = parsed({
    ...area,
    block: '10-3',
    unmatched: '信ビル',
    level: 8,
  });
  const noTail = parsed({ ...area, unmatched: '字北ノ作305-5クレオビル2F' });
  type FrontCase = [
    string,
    ParsedAddress,
    Partial<ParsedAddress>,
    string,
    boolean,
  ];
  const describeFrontCases = (title: string, cases: FrontCase[]): void => {
    describe(title, () => {
      for (const [name, whole, front, after, expected] of cases) {
        it(name, () => {
          assert.equal(
            isAddressFront(wholeContext(whole), parsed(front), {
              after,
              building: toBuilding(after),
            }),
            expected,
          );
        });
      }
    });
  };

  describeFrontCases('地域一致', [
    [
      '地域一致：地域が一致し末尾がある（level 3）',
      level3,
      { ...area, unmatched: '10' },
      'ビル',
      true,
    ],
    [
      '地域一致：町字が違う',
      level3,
      { ...area, town: '南三条西四丁目', unmatched: '10' },
      'ビル',
      false,
    ],
  ]);

  describeFrontCases('level 3 以上', [
    [
      'level 3 以上：level が 3 未満',
      level3,
      { ...area, unmatched: '10', level: 2 },
      'ビル',
      false,
    ],
  ]);

  describeFrontCases('末尾あり', [
    [
      '末尾あり：住所の末尾が全体と違ってもよい',
      level3,
      { ...area, block: '10-2', level: 8 },
      'ビル',
      true,
    ],
    [
      '末尾あり：住所の末尾が空',
      level3,
      { ...area, unmatched: '' },
      'ビル',
      false,
    ],
    [
      '末尾あり：住所の末尾が号だけ',
      level3,
      { ...area, unmatched: '号' },
      'ビル',
      false,
    ],
  ]);

  describeFrontCases('読み切り（全体の末尾がある）', [
    [
      '読み切り：unmatched に建物名が残る',
      level3,
      { ...area, unmatched: '10 AKASAKA' },
      'HILLS',
      false,
    ],
    [
      '読み切り：unmatched がハイフンで終わる',
      level3,
      { ...area, unmatched: '2-107-' },
      '716',
      false,
    ],
    [
      '読み切り：番地の間の 番・の は読み切れている',
      level3,
      { ...area, unmatched: '17番の2' },
      'ビル',
      true,
    ],
    [
      '読み切り：番地の間の 番- と末尾の号',
      level3,
      { ...area, unmatched: '2番-21号' },
      'ビル',
      true,
    ],
    [
      '読み切り：数字の間の 区',
      level3,
      { ...area, unmatched: '2区300-2' },
      'ビル',
      true,
    ],
    [
      '読み切り：末尾の番先',
      level3,
      { ...area, unmatched: '1番先' },
      'ビル',
      true,
    ],
    [
      '読み切り：level 8 の前半の unmatched が接尾語だけ',
      level3,
      { ...area, block: '6', unmatched: '番先', level: 8 },
      '6街区',
      true,
    ],
    [
      '読み切り：level 8 の前半の unmatched が空でも接尾語だけでもない',
      level3,
      { ...area, block: '10', unmatched: 'AKASAKA', level: 8 },
      'HILLS',
      false,
    ],
  ]);

  describeFrontCases('読み切り（全体の末尾が空）', [
    [
      '読み切り：全体の末尾が空なら、全体の unmatched の先頭と一致し数字で終わる',
      noTail,
      { ...area, unmatched: '字北ノ作305-5' },
      'クレオビル2F',
      true,
    ],
    [
      '読み切り：全体の末尾が空なら、全体の unmatched の先頭の短い部分でもよい',
      noTail,
      { ...area, unmatched: '字北ノ作305' },
      ' ビル',
      true,
    ],
    [
      '読み切り：全体の末尾が空で、全体の unmatched の先頭と一致しない',
      noTail,
      { ...area, unmatched: '字南ノ作305' },
      'ビル',
      false,
    ],
    [
      '読み切り：全体の末尾が空で、前半の unmatched が数字で終わらない',
      noTail,
      { ...area, unmatched: '字北ノ作305-5クレオ' },
      'ビル2F',
      false,
    ],
  ]);

  describeFrontCases('続きでない', [
    [
      '続きでない：建物部が 地＋数字 で始まる',
      level3,
      { ...area, unmatched: '9' },
      '地9 ビル',
      false,
    ],
    [
      '続きでない：建物部が の＋数字 で始まる',
      level3,
      { ...area, unmatched: '6' },
      'の4ビル',
      false,
    ],
    [
      '続きでない：建物部が 番先＋数字 で始まる',
      level3,
      { ...area, unmatched: '6' },
      '番先6街区',
      false,
    ],
    [
      '続きでない：建物部が 線 で始まる',
      level3,
      { ...area, unmatched: '1' },
      '線2号',
      false,
    ],
    [
      '続きでない：先頭のハイフンは落としてから見る',
      level3,
      { ...area, unmatched: '10' },
      '-202号室',
      true,
    ],
    [
      '続きでない：横棒の後ろの数字だけは枝番',
      level3,
      { ...area, unmatched: '1646' },
      'ー1',
      false,
    ],
    [
      '続きでない：横棒の後ろの 数字＋F＋英字 は番地の続き',
      level3,
      { ...area, unmatched: '17' },
      'ー1FAビレッジ',
      false,
    ],
    [
      '続きでない：横棒の後ろの 数字＋F＋記号 は階',
      level3,
      { ...area, unmatched: '8-13' },
      '-4F-CD号室',
      true,
    ],
    [
      '続きでない：横棒の後ろの 数字＋階＋英字 は階',
      level3,
      { ...area, unmatched: '15-7' },
      '-1階B',
      true,
    ],
  ]);

  describeFrontCases('番地の保持', [
    [
      '番地の保持：全体が level 8 で前半が level 3 なら受け入れない',
      level8,
      { ...area, unmatched: '10' },
      '3FUNDES',
      false,
    ],
    [
      '番地の保持：前半も level 8 なら受け入れる',
      level8,
      { ...area, block: '10', level: 8 },
      '3階',
      true,
    ],
    [
      '番地の保持：建物部が漢数字で始まれば受け入れる',
      level8,
      { ...area, unmatched: '10' },
      '三信ビル',
      true,
    ],
    [
      '番地の保持：空白で始まれば受け入れる',
      level8,
      { ...area, unmatched: '10' },
      ' 2階',
      true,
    ],
    [
      '番地の保持：空白で始まっても、先頭の数字が全体の番地の続きなら受け入れない',
      level8,
      { ...area, unmatched: '10' },
      ' 3号棟',
      false,
    ],
    [
      '番地の保持：空白の無い階の形は受け入れない（前半が level 8 未満）',
      level8,
      { ...area, unmatched: '10' },
      '-3F',
      false,
    ],
    [
      '番地の保持：空白の後ろの階の形は、番地の続きに見えても受け入れる',
      level8,
      { ...area, unmatched: '10' },
      ' 3階',
      true,
    ],
    [
      '番地の保持：空白の後ろでも F の直後が英字なら階でない',
      level8,
      { ...area, unmatched: '10' },
      ' 3FUSHI',
      false,
    ],
    [
      '番地の保持：空白の後ろでも F の直後が & なら階でない',
      level8,
      { ...area, unmatched: '10' },
      ' 3F&Gビル',
      false,
    ],
    [
      '番地の保持：空白の後ろでも F の直後が片仮名なら階でない',
      level8,
      { ...area, unmatched: '10' },
      ' 3Fビル1F',
      false,
    ],
    [
      '番地の保持：空白の後ろで F の直後が ( なら階',
      level8,
      { ...area, unmatched: '10' },
      ' 3F(77号室)',
      true,
    ],
  ]);
});

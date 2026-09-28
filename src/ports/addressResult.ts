/**
 * addressResult.ts
 *
 * @description 住所の正規化器（AddressNormalizer）のオプションと結果の型
 */

import type { CharStyle } from '@arihirookazaki/normalize-core';

/**
 * どこまで判別できたか（NJA 3.1.3 の level）。0：都道府県も判別できなかった、1：都道府県まで、2：市区町村まで、
 * 3：丁目・町字まで、8：住居表示住所または地番まで
 */
export type AddressLevel = 0 | 1 | 2 | 3 | 8;

/** 位置情報（NJA 3.1.3 の point。EPSG:4326（WGS84）） */
export interface AddressPoint {
  /** 緯度 */
  lat: number;
  /** 経度 */
  lng: number;
  /**
   * 位置の正確さ。1：都道府県の代表点、2：市区町村の代表点、3：丁目・町字の代表点、8：住居表示住所または地番の位置。
   * 結果の level と違うことがある
   */
  level: number;
}

/** 字形の指定を当てる項目 */
export type StyledField =
  'prefecture' | 'city' | 'town' | 'block' | 'building' | 'unmatched';

/**
 * 出力の字形の指定
 *
 * 各項目には、まずガード付き NFKC をかけ、そのあと default に項目ごとの指定をマージしたものを当てる。
 * style を省略したとき、またはクラスの指定を省略したときの既定は、ASCII の95字（digit・alpha・symbol・space）をすべて半角にする。
 * input と nja には何もかけない。
 */
export interface AddressStyle {
  /** すべての項目に共通の指定 */
  default?: CharStyle;
  /** 項目ごとの上書き。false なら字形の指定を当てない（ガード付き NFKC はかかる） */
  fields?: Partial<Record<StyledField, CharStyle | false>>;
}

/** AddressNormalizer.create のオプション */
export interface AddressNormalizerOptions {
  /** 字形の指定 */
  style?: AddressStyle;
  /** true なら NJA の結果を result.nja に入れる */
  nja?: boolean;
  /** true なら result.codes を入れる */
  codes?: boolean;
}

/**
 * 住所と建物部の切れ目の探索の結果
 *
 * - found：建物部を切り出した。building は空でなく、unmatched は住所の側の残り
 * - none：住所で終わっていて建物部が無い。building は ''
 * - unresolved：町字まで読めたが切れ目を決められなかった。building は ''、建物部は unmatched に残る
 * - skipped：level が 3 未満なので切れ目を探していない。building は ''、建物部は unmatched に残る
 */
export type SplitStatus = 'found' | 'none' | 'unresolved' | 'skipped';

/**
 * AddressNormalizer.normalize の結果
 *
 * split が 'found' で、建物部の始まりの位置で切ったときは、住所の項目・level・point・codes を
 * 前半（住所の部分）の解析の結果から取る。nja は常に全体（入力にガード付き NFKC をかけたテキスト）の解析の結果なので、
 * level と nja の中の level、block と nja の中の addr が違うことがある。
 */
export interface AddressResult {
  /** 渡された文字列そのまま */
  input: string;
  /** 都道府県（NJA の pref）。読めなければ null */
  prefecture: string | null;
  /** 郡＋市区町村＋政令市の区（NJA の city）。読めなければ null */
  city: string | null;
  /** 町字：大字・丁目・小字（NJA の town）。読めなければ null */
  town: string | null;
  /**
   * 番地等（NJA の addr）。住居表示の地域では「街区符号-住居番号」（例 21-3）、地番の地域では地番（例 3060-1）。
   * これは例で、住居番号だけのもの、住居番号2を含む3つ組、支号を含む地番（最大3つ組）もある。
   * 地番の地域では、道路で囲まれた街区ではなく一筆の土地を指す。読めなければ null
   */
  block: string | null;
  /**
   * 建物部。切り出さなかったときは ''。
   * split が 'skipped'・'unresolved' のときも '' で、建物部は unmatched に残るので、'' だけで「建物が無い」と判断せず split を見る
   */
  building: string;
  /**
   * データで確かめられなかった住所の残り（NJA の other にあたる）。無ければ ''。
   * split が 'found' なら建物部は building に切り出してある。'skipped'・'unresolved' のときは、建物部を含む残り全部。
   * NJA の other をもとにしているので、入力の字のままではない。算用数字・漢数字と隣り合う横棒（長音を含む）は常に - になり、
   * 町字まで読めたとき（level 3 以上）はさらに漢数字が算用数字に、番・号などが - になる。
   * building に切り出した建物部はこの変換を受けない（ガード付き NFKC と字形の指定だけ）。'skipped'・'unresolved' では建物名が unmatched に残り、この変換を受ける
   */
  unmatched: string;
  /** NJA の level（split が 'found' のときの取り方は AddressResult の説明を参照） */
  level: AddressLevel;
  /** 位置情報。無ければ null */
  point: AddressPoint | null;
  /** 切れ目の探索の結果（各値の意味と building・unmatched は SplitStatus を参照） */
  split: SplitStatus;
  /**
   * lgCode は市区町村の全国地方公共団体コード（6桁）で、市区町村まで読めなければ null（都道府県のコードは入らない）。
   * machiazaId は町字 ID（7桁）で、町字まで読めなければ null。codes オプションが true のときだけ入る
   */
  codes?: { lgCode: string | null; machiazaId: string | null };
  /**
   * NJA の結果の写し（書き換えてもほかの結果に影響しない）。常に全体（入力にガード付き NFKC をかけたテキスト）の解析の結果。
   * nja オプションが true のときだけ入る
   */
  nja?: Readonly<Record<string, unknown>>;
}

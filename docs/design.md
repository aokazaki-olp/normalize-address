# normalize-address 設計

日本の住所を正規化する。住所の解析は NJA（`@geolonia/normalize-japanese-addresses` 3.1.3）に任せ、建物部を入力から取り直す。系列全体の設計と決定の経緯は作業場所の `docs/design.md` にある。

補助資料：[japanese-address-structure.md](japanese-address-structure.md)（住所の構造と訳語）、[nja-3.1.3-char-rules.md](nja-3.1.3-char-rules.md)（NJA 3.1.3 の文字の扱い）

## 公開 API

```ts
export const normalizeAddress: (
  input: string,
  options?: NormalizeAddressOptions,
) => Promise<AddressResult>;

export interface NormalizeAddressOptions {
  style?: AddressStyle; // 字形の指定（下記）
  nja?: boolean; // true なら NJA の結果（手順2）を result.nja に入れる
  codes?: boolean; // true なら result.codes を入れる
}

export interface AddressResult {
  input: string; // 渡された文字列そのまま
  prefecture?: string; // NJA の pref
  city?: string; // NJA の city（郡＋市区町村＋政令市の区）
  town?: string; // NJA の town（町字：大字・丁目・小字）
  number?: string; // NJA の addr（街区符号-住居番号、または地番）
  building: string; // 建物部。無ければ ''
  other: string; // 住所として読めなかった残り
  level: 0 | 1 | 2 | 3 | 8; // NJA の level
  point?: { lat: number; lng: number; level: number };
  split: 'found' | 'none' | 'unresolved' | 'skipped';
  codes?: { lgCode?: string; machiazaId?: string };
  nja?: Readonly<Record<string, unknown>>;
}
```

- 名前は NJA の分け方に合わせ、略称だけを正式な語にする（`pref` → `prefecture`、`addr` → `number`）。`city`・`town` の中身は NJA の定義のまま
- 字形は、ガード付き NFKC（`@arihirookazaki/normalize-core`）をかけた後の文字列。`prefecture`〜`number` は NJA が返すマスターの表記
- `codes.lgCode` は全国地方公共団体コード（6桁の文字列）。JAv2 の市区町村コードは数値で先頭のゼロが落ちているので、6桁にそろえる（札幌市中央区 `11011` → `011011`）。`codes.machiazaId` は町字 ID（7桁の文字列）
- `nja` は NJA の結果をそのまま入れる。NJA の版によって形が変わりうる
- 引数が文字列でなければ `TypeError`。住所データの取得に失敗したら `AddressDataError` を投げる（下記）

## 処理の流れ

1. 入力にガード付き NFKC をかける（以下、これを「テキスト」と呼ぶ）
2. テキスト全体を NJA にかける
3. level が 3 未満なら、切れ目を探さない（`split: 'skipped'`、`building: ''`）
4. 住所の末尾を決める。level 8 なら NJA の `addr`、level 3 なら NJA の `other` の先頭の番地らしい部分（`^[0-9]+(-[0-9]+)*`）。level 3 で番地らしい部分の直後に `号` `番地` `番` `地` のどれか（この順の最長一致で1回）が続くなら、それも住所の末尾の一部として残りから除く（住所の末尾の値は数字とハイフンのまま）。テキストの残りが無ければ `split: 'none'`
5. 切れ目の候補を前から順に試し、その位置までの前半を NJA にかける。都道府県・市区町村・町字・住所の末尾が全体の結果と一致した最初の位置で切る（`split: 'found'`）。後半が `building`
   - 切れ目の候補は、テキストの先頭と末尾を除く位置のうち、次のどちらかに当たるもの
     - 直前が `号` `地`（直後の字を問わない）
     - 直前が数字・漢数字・`番` `目` で、直後が数字・`号` `番` `地` のどれでもない
   - 前半の住所の末尾は、NJA の `number` と、`other` の末尾の `号` `番地` `番` `地`（この順の最長一致で1回）を落としたものを、空でないものだけ `-` でつないだもの
   - `building` は、後半の前後の空白を落とし、先頭のハイフン（ガード付き NFKC の後なので `-`。続いていればすべて）を落とし、さらに前後の空白を落としたもの。これが空になったら `split: 'none'`、`building` は `''`、`other` は全体の結果のまま
6. 一致する位置が無ければ `split: 'unresolved'`。`building` は `''`、`other` は全体の結果のまま

出力の `prefecture`〜`number`・`level`・`point` は手順2（全体の結果）、`other` は `found` のとき前半の結果のもの。

## 字形の指定

```ts
export interface AddressStyle {
  default?: CharStyle; // すべての項目に共通
  fields?: Partial<Record<StyledField, CharStyle | false>>; // 項目ごとの上書き
}
type StyledField =
  'prefecture' | 'city' | 'town' | 'number' | 'building' | 'other';
```

- `CharStyle` と、その当て方（`applyCharStyle`・`mergeCharStyle`）は `@arihirookazaki/normalize-core` のもの
- 各項目には、まずガード付き NFKC をかけ（マスターの全角 `相生１号` などを半角にそろえる）、そのあと `default` に項目ごとの指定をマージしたものを当てる。項目ごとの指定が `false` なら、字形の指定は当てない（ガード付き NFKC だけ）
- `input` には何もかけない。`nja` にもかけない
- 字形の指定は出力の直前にだけ当てる。処理の途中（手順1〜6）は当てない

## 失敗の扱い

NJA 3.1.3 は取得した応答が正常かを確かめず、住居表示・地番のデータでエラーが返ると例外にならずに level 3 に落ち、その結果がキャッシュされる。NJA が公開している `requestHandlers.http` を差し替え、次を失敗として `AddressDataError`（URL とステータスを持つ）を投げる。

- 範囲指定の取得（住居表示・地番の `.txt`）で `206` 以外
- それ以外の取得で 2xx 以外

`requestHandlers` はモジュール全体で1つなので、差し替えは最初の呼び出しの前に1回だけ行う。同じプロセスで NJA を直接使う別のコードがあれば、その挙動も変わる。

## レイヤーと依存の向き

```
src/
  index.ts       公開面。既定の実装を組み立てて normalizeAddress を公開する
  application/   処理の流れ（手順1〜6）。ports の AddressParser だけを通して解析する
  domain/        純粋な処理（切れ目の候補、住所の末尾、結果の比較と組み立て）
  ports/         インターフェース（AddressParser）と型だけ
  adapters/      外部との接続。NJA と取得の失敗の判定
```

| 層             | import してよい他の層            | import してよい外部                                |
| -------------- | -------------------------------- | -------------------------------------------------- |
| `index.ts`     | `application` `adapters` `ports` | `@arihirookazaki/normalize-core`（型の再公開だけ） |
| `application/` | `domain` `ports`                 | `@arihirookazaki/normalize-core`                   |
| `domain/`      | `ports`                          | `@arihirookazaki/normalize-core`                   |
| `ports/`       | なし                             | `@arihirookazaki/normalize-core`（型だけ）         |
| `adapters/`    | `ports`                          | すべて（NJA、`node:` のモジュールなど）            |

- この表を lint で止める。動的 `import()` も同じ
- テストでは、決まった結果を返す偽の `AddressParser` を注入すれば、NJA もネットワークも使わずに手順1〜6を確かめられる。取得の失敗の判定は、偽の取得関数を渡して確かめる

## 依存

- `@geolonia/normalize-japanese-addresses` は `3.1.3` に固定する（2026-09-27 時点で npm の最新）
- `@arihirookazaki/normalize-core` は Git の URL で書き、`bundleDependencies` で同梱する。開発中は手元のリポジトリ（`git+file:`）を指し、契約の調整のときに GitHub の URL（`github:aokazaki-olp/normalize-core#<コミット>`）に切り替える

## 既知の制限

- NJA の誤認はそのまま出る（京都の通り名での町字の誤り、`字` の扱いなど）
- マスターが NFKC で変わる字形で登録されている町字は一致しなくなる（`蝉ｹ平`、全角括弧の町字など）
- ハイフンでつながった部屋番号（`3-1-211`）は、level 3 では番地と区別できない
- 住所データは Geolonia の API から取得する

## 今回やらないこと

部屋番号の判定、タブ・改行の扱い、建物部を入力の字のまま返すこと

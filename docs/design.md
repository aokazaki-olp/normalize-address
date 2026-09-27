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
4. 建物部の始まりの位置の候補（下記「建物部の始まりの位置」）を順に試す。候補の位置で切った後半から `building` を取り出し（手順7と同じ）、空なら次の候補へ。空でなければ前半を NJA にかけ、次のすべてを満たせば切る（`split: 'found'`）
   - 都道府県・市区町村・町字が全体の結果と一致する
   - 前半の level が 3 以上
   - 前半の住所の末尾（手順7）が空でない
   - 前半が住所として読み切れている。全体の住所の末尾（手順5）が空でないなら、前半の `other`（前後の空白を除く）が空か `^[0-9]+((-|番地の|番地|番の|番-|番|号|の|ノ|街区)[0-9]+)*(号|番地|番|地)?$` に当たる（前半が level 8 なら空。数字の間に `番` `の` `号` `街区` などが残るのは、NJA が level 3 で番地を読み切れず `other` に残した形：`17番の2`、`2番-21号`、`16号7`、`1街区1号`）。全体の住所の末尾が空（NJA の町字の判定が途中で止まった入力）なら、全体の `other`（前後の空白を除く）が前半の `other`（同）で始まり、前半の `other` が数字か `号` `番地` `番` `地` で終わる
   - `building` が住所の続きで始まらない。`^(番地|番|号|地|[のノ]|[ー-])(?=[0-9])` に当たるもの、`線` で始まるものは受け入れない
   - データで確定した番地を上書きしない。全体が level 8 で前半の level が 8 未満なら、次のどちらかのときだけ受け入れる
     - `building` が漢数字で始まる（建物名の先頭の漢数字を NJA が番地に読む形）
     - 後半が利用者の入力した空白で始まり、かつ `building` の先頭の数字が全体の番地の続きでない（全体の住所の末尾が、前半の住所の末尾と `building` の先頭の数字を `-` でつないだものと一致しない。`13番 10号棟101号` で全体が `13-10` なら受け入れない）

   受け入れなければ次の候補へ進み、候補が尽きたら手順5へ進む

5. 住所の末尾を決める。level 8 なら NJA の `addr`、level 3 なら NJA の `other` の先頭の番地らしい部分（`^[0-9]+(-[0-9]+)*`）。住所の末尾が空でなく、その直後（level 8 なら `other` の先頭）に `号` `番地` `番` `地` のどれか（この順の最長一致で1回）が続くなら、それも住所の末尾の一部として残りから除く（住所の末尾の値は数字とハイフンのまま）。テキストの残りが無ければ `split: 'none'`
6. 切れ目の候補を前から順に試し、その位置までの前半を NJA にかける。都道府県・市区町村・町字・住所の末尾が全体の結果と一致した最初の位置で切る（`split: 'found'`）。後半が `building`
   - 切れ目の候補は、テキストの先頭と末尾を除く位置のうち、次のどちらかに当たるもの
     - 直前が `号` `地`（直後の字を問わない）
     - 直前が数字・漢数字・`番` `目` で、直後が数字・`号` `番` `地` のどれでもない
7. 手順4と6で使う定義
   - 前半の住所の末尾は、NJA の `number` と、`other` の末尾の `号` `番地` `番` `地`（この順の最長一致で1回）を落としたものを、空でないものだけ `-` でつないだもの
   - `building` は、後半の前後の空白を落とし、先頭のハイフン（ガード付き NFKC の後なので `-`。続いていればすべて）を落とし、さらに前後の空白を落としたもの。手順6でこれが空になったら `split: 'none'`、`building` は `''`、`other` は全体の結果のまま
8. 一致する位置が無ければ `split: 'unresolved'`。`building` は `''`、`other` は全体の結果のまま

出力の項目は次の結果から取る。

| 項目                                              | 手順4で切ったとき | それ以外                                            |
| ------------------------------------------------- | ----------------- | --------------------------------------------------- |
| `prefecture`〜`number`・`level`・`point`・`codes` | 前半の結果        | 全体の結果（手順2）                                 |
| `other`                                           | 前半の結果        | 手順6で切ったときは前半の結果、それ以外は全体の結果 |
| `nja`                                             | 全体の結果        | 全体の結果                                          |

手順4で前半の結果を使うのは、全体の結果が NJA の誤読を含みうるため（建物名の先頭の漢数字を番地に読む、空白を消して後ろの数字を番地につなげる）。

## 建物部の始まりの位置

abr-geocoder 3.0.51（`github.com/digital-go-jp/abr-geocoder`、タグ `3.0.51`、コミット `4a466ed40b65b658368ef3614eafd1709ac83a86`）の Go 実装 abrg は、照合の前に正規表現で住所の番号をハイフンの形にし、建物部の前に空白を入れ、照合には最初の空白より前だけを使う。この切り分けの規則を domain 層に移植し、建物部の始まりの位置を求めるためだけに使う。NJA には整えた文字列を渡さず、テキストをその位置で切る。

候補は次の順に最大2つ（同じ位置は1つにまとめる。テキストの先頭と末尾は除く）。

1. abrg の規則：テキストの写しに下の「移植した処理」をかけ、その結果で最初の算用数字より後ろにある最初の空白の、後ろの部分を建物部とする。利用者が入れた空白も規則の出力に残るので、最初の算用数字より後ろの最初の空白は同じように候補になる（`東京都 千代田区 …` のように算用数字より前の空白は候補にしない）
2. abrg に無い独自の規則：写しの中で、ハイフンでつないだ3つ以上の番号のあとに `-` と `N号室` または `N室` が続くとき（`(?<![0-9-])[0-9]+(-[0-9]+){2,}-[0-9]+(号室|室)` の最初の一致）、その最後の `-` の位置。部屋番号を明示しているので建物部にする（`清川2-12-4-102号室` → `102号室`）

### 移植した処理

abrg の `NormalizeBasicNormalized` と、それが呼ぶ関数を忠実に移す。

- 最初の `(` から後ろを切り離し、住所の型（住居表示・地番・判定不能・不明）を判定する（`detectAddressType`）
- 型に応じて番号の表記を整える（`applyAddressFormatting`。`AddressNumbersToHyphen`、`addSpaceAfterFirstArabicNumber`、`addSpaceAfterNumberBeforeJapanese`）
- 空白をそろえ、括弧を戻し、括弧と読点の前後に空白を入れる（`NormalizeSpaces`、`addSpacesAroundPunctuation`）

`BasicNormalize` のうち、引用符・コメント・異体字セレクタの除去と NFKC は移さない（テキストは既にガード付き NFKC をかけてある）。移植した規則が前提にする形にそろえるため、写しにだけ空白の統一（`NormalizeSpaces`。空白は Go の `unicode.IsSpace` の集合）と横棒の統一（`NormalizeDashes`。17種の横棒と、数字に挟まれた `ー`）をかけてから、上の処理をかける。

移植の決まり：

- Go の `\s` は `[\t\n\f\r ]`、`.` は改行以外、`\d` は ASCII の数字として書き換える。文字クラスの中の `-` はエスケープする
- 規則の表は宣言の順に1回ずつ全件を置き換える（`applyRules`）。`ApplyFirstMatch` は最初に文字列を変えた1規則だけを当てる
- バイト単位の処理は文字単位に書き換える（関わる字はすべて BMP）
- abrg のテストの入力と期待値（`address_hyphen_test.go`・`address_type_test.go`・`normalize_test.go`・`pipeline_test.go` の表の276件と `TestBasicNormalize_Pipeline` の1件）をテストに移す。移していない前処理（引用符・コメント・異体字セレクタの除去）に頼る10件は、落ちることを TODO として残す

### 元のテキストの位置への対応づけ

写しの各字に、元のテキストでの位置を持たせたまま置き換える（正規表現のグループに当たった字は元の位置を保ち、テンプレートの字は挿入した字として扱う）。規則は字の順序を入れ替えないので、位置は増える順に並ぶ。

- 建物部の始まりは、空白より後ろにある字の元の位置のうち最小のもの
- 空白より前にある字の元の位置の最大より前になるなら使わない。空白より後ろに元の位置を持つ字が無いときも使わない
- 始まりの直前が、写しで空白・ハイフンになった字か写しで消えた空白・横棒なら、空白より前の字に届くまで始まりを前へずらす（前半に空白やハイフンを残さない）。写しで消えた `号` `番` などは前半に残す

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
- 字形の指定は出力の直前にだけ当てる。処理の途中（手順1〜8）は当てない

## 失敗の扱い

NJA 3.1.3 は取得した応答が正常かを確かめず、住居表示・地番のデータでエラーが返ると例外にならずに level 3 に落ち、その結果がキャッシュされる。NJA が公開している `requestHandlers.http` を差し替え、次を失敗として `AddressDataError`（URL とステータスを持つ）を投げる。

- 範囲指定の取得（住居表示・地番の `.txt`）で `206` 以外
- それ以外の取得で 2xx 以外

`requestHandlers` はモジュール全体で1つなので、差し替えは最初の呼び出しの前に1回だけ行う。同じプロセスで NJA を直接使う別のコードがあれば、その挙動も変わる。

## レイヤーと依存の向き

```
src/
  index.ts       公開面。既定の実装を組み立てて normalizeAddress を公開する
  application/   処理の流れ（手順1〜8）。ports の AddressParser だけを通して解析する
  domain/        純粋な処理（切れ目の候補、建物部の始まりの位置と abrg の規則の移植、住所の末尾、結果の比較と組み立て）
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
- テストでは、決まった結果を返す偽の `AddressParser` を注入すれば、NJA もネットワークも使わずに手順1〜8を確かめられる。取得の失敗の判定は、偽の取得関数を渡して確かめる

## 依存

- `@geolonia/normalize-japanese-addresses` は `3.1.3` に固定する（2026-09-27 時点で npm の最新）
- abr-geocoder 3.0.51 の規則はコードとして移植しており、依存には入れない。移植したファイルとテストの固定データは、リポジトリ直下の `THIRD_PARTY_NOTICES.md` に著作権表示と MIT の許諾文とともに列挙し、配布物にも入れる
- `@arihirookazaki/normalize-core` は Git の URL で書き、`bundleDependencies` で同梱する。開発中は手元のリポジトリ（`git+file:`）を指し、契約の調整のときに GitHub の URL（`github:aokazaki-olp/normalize-core#<コミット>`）に切り替える

## 既知の制限

- NJA の誤認はそのまま出る（京都の通り名での町字の誤り、`字` の扱いなど）
- マスターが NFKC で変わる字形で登録されている町字は一致しなくなる（`蝉ｹ平`、全角括弧の町字など）
- ハイフンでつながった部屋番号（`3-1-211`）は、level 3 では番地と区別できない（`号室` `室` で終わり、番号が4つ以上並ぶものは建物部の始まりの位置の独自の規則で切る）
- 建物部の始まりの位置は、abrg の規則の出力で最初の算用数字より後ろの最初の空白だけを見る。その前半が住所として使えなければ、手順6の探索に戻る
- 住所データは Geolonia の API から取得する

## 今回やらないこと

部屋番号の判定、タブ・改行の扱い、建物部を入力の字のまま返すこと

# normalize-address 設計

日本の住所を正規化する。住所の解析は NJA（`@geolonia/normalize-japanese-addresses` 3.1.3）に任せ、建物部を入力から取り直す。系列全体の設計と決定の経緯は作業場所の `docs/design.md` にある。

補助資料：[japanese-address-structure.md](japanese-address-structure.md)（住所の構造と訳語）、[nja-3.1.3-char-rules.md](nja-3.1.3-char-rules.md)（NJA 3.1.3 の文字の扱い）

## 公開 API

```ts
export const AddressNormalizer = { create };

// 住所の正規化器を作る。options は create のときに1回だけ検査・準備する
const create: (options?: AddressNormalizerOptions) => AddressNormalizer;

export interface AddressNormalizer {
  normalize(input: string): Promise<AddressResult>;
}

export interface AddressNormalizerOptions {
  style?: AddressStyle; // 字形の指定（下記）
  nja?: boolean; // true なら NJA の結果（手順2）を result.nja に入れる
  codes?: boolean; // true なら result.codes を入れる
}

export interface AddressResult {
  input: string; // 渡された文字列そのまま
  prefecture?: string; // NJA の pref
  city?: string; // NJA の city（郡＋市区町村＋政令市の区）
  town?: string; // NJA の town（町字：大字・丁目・小字）
  block?: string; // NJA の addr（番地等：街区符号-住居番号、または地番）
  building: string; // 建物部。無ければ ''
  unmatched: string; // データで確かめられなかった住所の残り（NJA の other にあたる）
  level: 0 | 1 | 2 | 3 | 8; // NJA の level
  point?: { lat: number; lng: number; level: number };
  split: 'found' | 'none' | 'unresolved' | 'skipped';
  codes?: { lgCode?: string; machiazaId?: string };
  nja?: Readonly<Record<string, unknown>>;
}
```

- 名前は NJA の分け方に合わせ、`pref` は正式な語 `prefecture` にする。`city`・`town` の中身は NJA の定義のまま
- `block` は NJA の `addr`。日本郵便の郵便番号・デジタルアドレス API の `block_name`（説明は「番地等文字列」、英語の説明は "block name"。API 仕様書 1.1.0.260723、2026-09-28 確認）に名前を合わせた。住居表示の地域では「街区符号-住居番号」（例 `21-3`）、地番の地域では地番（例 `3060-1`）。地番の地域では、道路で囲まれた街区ではなく一筆の土地を指す。OSM の `addr:block_number` とは指すものが違う（英語版 wiki は道路で囲まれた区域の番号、日本語版 wiki は「街区符号または番地」で、住居番号・枝番号は `addr:housenumber` に分ける。2026-09-28 確認）
- `unmatched` は、データで確かめられなかった住所の残り。中身は NJA の `other`（NJA 3.1.3 の README の説明は「正規化できなかった文字列」）と同じ種類のものだが、建物部は `building` に切り出してある。`split` が `'unresolved'` のときは、建物部を含む残り全部が入る。名前は abr-geocoder 3.x の `unmatched_address`（3.0.51 で確認。照合できなかった部分。型は文字列の配列）と同じ語にした。日本郵便の API の `other_name`（説明は「その他住所文字列」、英語の説明は "Building number, room number, and other details"）と紛れないように `other` を使わない
- `nja` の中の `addr`・`other` は NJA の名前のまま（NJA の結果そのものなので変えない）
- 字形は、ガード付き NFKC（`@arihirookazaki/normalize-core`）をかけた後の文字列。`prefecture`〜`block` は NJA が返すマスターの表記
- `codes.lgCode` は全国地方公共団体コード（6桁の文字列）。JAv2 の市区町村コードは数値で先頭のゼロが落ちているので、6桁にそろえる（札幌市中央区 `11011` → `011011`）。`codes.machiazaId` は町字 ID（7桁の文字列）
- `nja` は NJA の結果をそのまま入れる。NJA の版によって形が変わりうる
- 公開する値は `AddressNormalizer`（モジュールオブジェクト、規約 §2.1）と `NormalizeAddressError` だけ。型は `AddressNormalizer`・`AddressNormalizerOptions`・`AddressResult`・`AddressStyle` と、normalize-core の `CharStyle`・`CharTarget`・`WidthMode` を再公開する。関数（`applyCharStyle` など）は再公開しない
- `create` は options を1回だけ検査・準備する（字形の指定の検査と、`default` と項目ごとの指定のマージ）。options が検査を満たさなければ `create` が `TypeError` を投げ、`normalize` は呼ぶ前から使えない。準備したものは写しなので、`create` のあとで options を書き換えても正規化器には効かない
- NJA の設定・取得処理の差し替え（下記「失敗の扱い」）・住所データのキャッシュはプロセスに1つで、`create` を何回呼んでもすべての正規化器で共有される。取得先（エンドポイント）などは `create` の引数に入れない
- `create` の入力の誤り（options が object でない、`nja`・`codes` が boolean でない、字形の指定が検査を満たさない）と、`normalize` の入力の誤り（引数が文字列でない）は `TypeError`。それ以外で処理を終えられなかったものは `normalize` が `NormalizeAddressError` を投げる（下記「失敗の扱い」）

## 処理の流れ

1. 入力にガード付き NFKC をかける（以下、これを「テキスト」と呼ぶ）
2. テキスト全体を NJA にかける
3. level が 3 未満なら、切れ目を探さない（`split: 'skipped'`、`building: ''`）
4. 建物部の始まりの位置の候補（下記「建物部の始まりの位置」）を順に試す。候補の位置で切った後半から `building` を取り出し（手順7と同じ）、空なら次の候補へ。空でなければ前半を NJA にかけ、次のすべてを満たせば切る（`split: 'found'`）
   - 都道府県・市区町村・町字が全体の結果と一致する
   - 前半の level が 3 以上
   - 前半の住所の末尾（手順7）が空でない
   - 前半が住所として読み切れている。全体の住所の末尾（手順5）が空でないなら、前半の `other`（前後の空白を除く）が空か `^[0-9]+((-|番地の|番地|番の|番-|番|号|の|ノ|街区|区)[0-9]+)*(号|番地先|番先|番地|番|地先|地)?$` に当たる（前半が level 8 なら空か住所の接尾語だけ（`6番先` の前半で NJA が返す `番先`）。数字の間に `番` `の` `号` `街区` `区` などが残るのは、NJA が level 3 で番地を読み切れず `other` に残した形：`17番の2`、`2番-21号`、`16号7`、`1街区1号`、`2区300-2`（町字は `大町`））。全体の住所の末尾が空（NJA の町字の判定が途中で止まった入力）なら、全体の `other`（前後の空白を除く）が前半の `other`（同）で始まり、前半の `other` が数字か住所の接尾語（手順5）で終わる
   - `building` が住所の続きで始まらない。`^(番地先|番先|番地|番|号|地先|地|[のノ])(?=[0-9])` に当たるもの、`線` で始まるもの、後半の先頭に横棒（手順7）があり、それを落とした `building` が数字で始まるのに階の形（`^[0-9]+(階|F(?![A-Za-z]))`）でも部屋番号の形（`^[0-9]+(号室|室)`）でもないもの（`1646番地ー1` の `ー1`、`1ー17ー1FAビレッジ` の `ー1FA…` は番地の続き）は受け入れない
   - データで確定した番地を上書きしない。全体が level 8 で前半の level が 8 未満なら、次のどちらかのときだけ受け入れる
     - `building` が漢数字で始まる（建物名の先頭の漢数字を NJA が番地に読む形）
     - 後半が利用者の入力した空白で始まり、かつ `building` の先頭の数字が全体の番地の続きでない（全体の住所の末尾が、前半の住所の末尾と `building` の先頭の数字を `-` でつないだものと一致しない。`13番 10号棟101号` で全体が `13-10` なら受け入れない）。ただし `building` がはっきりした階の形（`^[0-9]+(階|F(?=$|[\s0-9・、,(]))`）なら番地の続きとみなさない（`岩瀬164番地 1階` は 164 と `1階`）。F は直後が末尾・空白・数字・`・` `、` `,` `(` のときだけ階とする（`16-12F&Gビル`、`2-22Fビル1F` のように F が建物名の一部になる形を階と読まないため）

     階の形でも、空白の無い `-3F` `-2階` はこの例外に入れない。前半（短い番地）が level 8 未満になるのは短い番地が住所データに無いときで、そのときは長い番地が正しかった（`北一条西5-2-9F` は所在地 `北1条西5-2-9` の8階建てのビルで、5-2-9 が level 8、5-2 が level 3。`越水町1-2F84` も 1-2 が level 8、1 が level 3）。短い番地もデータにある `矢吹町中町234-2階` は前半も level 8 なので、この条件の対象外で 234 と `2階` になる

   受け入れなければ次の候補へ進み、候補が尽きたら手順5へ進む

5. 住所の末尾を決める。level 8 なら NJA の `addr`、level 3 なら NJA の `other` の先頭の番地らしい部分（`^[0-9]+(-[0-9]+)*`）。住所の末尾が空でなく、その直後（level 8 なら `other` の先頭）に住所の接尾語 `号` `番地先` `番先` `番地` `番` `地先` `地` のどれか（この順で最初に当たるものを1回）が続くなら、それも住所の末尾の一部として残りから除く（住所の末尾の値は数字とハイフンのまま）。テキストの残りが無ければ `split: 'none'`
6. 切れ目の候補を前から順に試し、その位置までの前半を NJA にかける。都道府県・市区町村・町字・住所の末尾が全体の結果と一致した最初の位置で切る（`split: 'found'`）。後半が `building`
   - 切れ目の候補は、テキストの先頭と末尾を除く位置のうち、次のどちらかに当たるもの
     - 直前が `号` `地`（直後の字を問わない）
     - 直前が数字・漢数字・`番` `目` で、直後が数字・`号` `番` `地` のどれでもない
7. 手順4と6で使う定義
   - 前半の住所の末尾は、NJA の `addr` と、`other` の末尾の住所の接尾語（手順5。1回）を落としたものを、空でないものだけ `-` でつないだもの
   - `building` は、後半の前後の空白を落とし、先頭の横棒（NJA 3.1.3 が横棒として扱う字。normalize-core の `HORIZONTAL_BAR` と同じ字の集合で、長音 `ー` を含む。続いていればすべて）を落とし、さらに前後の空白を落としたもの。建物名が `ー` で始まることは実質ないと判断した。手順6でこれが空になったら `split: 'none'`、`building` は `''`、`unmatched` は全体の結果（NJA の `other`）のまま
8. 一致する位置が無ければ `split: 'unresolved'`。`building` は `''`、`unmatched` は全体の結果（NJA の `other`）のまま

出力の項目は次の結果から取る。

| 項目                                             | 手順4で切ったとき | それ以外                                            |
| ------------------------------------------------ | ----------------- | --------------------------------------------------- |
| `prefecture`〜`block`・`level`・`point`・`codes` | 前半の結果        | 全体の結果（手順2）                                 |
| `unmatched`                                      | 前半の結果        | 手順6で切ったときは前半の結果、それ以外は全体の結果 |
| `nja`                                            | 全体の結果        | 全体の結果                                          |

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
  'prefecture' | 'city' | 'town' | 'block' | 'building' | 'unmatched';
```

- `CharStyle` と、その当て方（`applyCharStyle`・`mergeCharStyle`）は `@arihirookazaki/normalize-core` のもの
- 各項目には、まずガード付き NFKC をかけ（マスターの全角 `相生１号` などを半角にそろえる）、そのあと `default` に項目ごとの指定をマージしたものを当てる。項目ごとの指定が `false` なら、字形の指定は当てない（ガード付き NFKC だけ）
- 既定（`style` を省略したとき、またはクラスの指定を省略したとき）は、ASCII の95字（digit・alpha・symbol・space）をすべて半角にする。grep や旧来のテキストエディタで扱いやすくするため
- ASCII に似た ASCII 以外の字（`−` U+2212、`‐` U+2010、`―` U+2015、`〜` U+301C、`’` U+2019 など）は、既定では置き換えない。ガード付き NFKC でも残る。そろえたい利用者は `chars` で指定する。このうち `−` `–` `—` `〜` は Shift_JIS（CP932）の表に無い
- `input` には何もかけない。`nja` にもかけない
- 字形の指定は出力の直前にだけ当てる。処理の途中（手順1〜8）は当てない
- 検査とマージは `create` で1回だけ行う。`style`・`default`・`fields` は object、`fields` のキーは上の6項目、値は `CharStyle` か `false`。マージした指定は項目ごとに normalize-core の検査（`applyCharStyle` と同じもの）にかける

## 失敗の扱い

例外は2種類に分ける。

- `TypeError`：入力の誤りだけ（`create` の options が検査を満たさない、`normalize` の引数が文字列でない）。同じ入力で再試行しても同じ
- `NormalizeAddressError`：それ以外で、正規化器が処理を終えられなかったもの。その入力をあとで再試行する価値がある（ただし NJA の想定外の level は、再試行しても同じ）

```ts
export class NormalizeAddressError extends Error {
  readonly name: 'NormalizeAddressError';
  readonly url: string | undefined; // 取得の失敗のとき、取得した URL（API キーを書き足す前）
  readonly status: number | undefined; // HTTP の応答があったときのステータス
  // 元の例外は cause（ErrorOptions）に入れる
}
```

利用者は `instanceof` ではなく `name` で判定できる（`error.name === 'NormalizeAddressError'`）。`instanceof` は realm を跨ぐと誤判定し、同じクラスが別の複製として読み込まれたときも一致しないため（規約 §6.2）。

`NormalizeAddressError` を投げるのは次のとき。

| 場面                                                                                                  | `url` | `status` | `cause`  |
| ----------------------------------------------------------------------------------------------------- | ----- | -------- | -------- |
| 住所データの範囲指定の取得（住居表示・地番の `.txt`）で `206` 以外                                    | あり  | あり     | なし     |
| 住所データのそれ以外の取得で 2xx 以外                                                                 | あり  | あり     | なし     |
| 取得処理そのものが例外を投げた（Node の fetch の `TypeError: fetch failed` などのネットワークの失敗） | あり  | なし     | 元の例外 |
| NJA が想定外の level（0・1・2・3・8 以外）を返した                                                    | なし  | なし     | なし     |

NJA 3.1.3 は取得した応答が正常かを確かめず、住居表示・地番のデータでエラーが返ると例外にならずに level 3 に落ち、その結果がキャッシュされる。NJA が公開している `requestHandlers.http` を差し替え、上の取得の失敗を検査して `NormalizeAddressError` を投げる。取得処理が投げた例外もここで包む（包まないと `TypeError` として出て、入力の誤りと区別できない）。

`requestHandlers` はモジュール全体で1つなので、差し替えは最初の解析の前に1回だけ行う。`create` を何回呼んでも差し替えは1回で、すべての正規化器が同じ取得処理と住所データのキャッシュを使う。同じプロセスで NJA を直接使う別のコードがあれば、その挙動も変わる。

## レイヤーと依存の向き

```
src/
  index.ts       公開面。NJA の AddressParser を1つ作り、それを使う create を AddressNormalizer として公開する
  application/   処理の流れ（手順1〜8）。ports の AddressParser だけを通して解析する
  domain/        純粋な処理（options の検査と準備、切れ目の候補、建物部の始まりの位置と abrg の規則の移植、住所の末尾、結果の比較と組み立て）
  ports/         インターフェース（AddressParser、AddressNormalizer）と型だけ
  adapters/      外部との接続。NJA と取得の失敗の判定、NormalizeAddressError
```

| 層             | import してよい他の層            | import してよい外部                                |
| -------------- | -------------------------------- | -------------------------------------------------- |
| `index.ts`     | `application` `adapters` `ports` | `@arihirookazaki/normalize-core`（型の再公開だけ） |
| `application/` | `domain` `ports`                 | `@arihirookazaki/normalize-core`                   |
| `domain/`      | `ports`                          | `@arihirookazaki/normalize-core`                   |
| `ports/`       | なし                             | `@arihirookazaki/normalize-core`（型だけ）         |
| `adapters/`    | `ports`                          | すべて（NJA、`node:` のモジュールなど）            |

- この表を lint で止める。動的 `import()` も同じ
- `NormalizeAddressError` は adapters に置く。投げるのは adapters だけで、application と domain は受け取らずにそのまま伝える。ports は型だけの層で、クラス（値）を置くと application・domain が値として import できるようになるため置かない。公開は `index.ts` が adapters から再 export する
- ports の `ParsedAddress` の項目名は結果と同じ `block`・`unmatched` にする（同じ概念に別の名前を並べない）。NJA の `addr`・`other` から写すのは adapters だけ
- application は `createAddressNormalizer(parser, options)` で正規化器を作る。`index.ts` の `create` はこれに NJA の AddressParser を渡すだけ
- 型の `AddressNormalizer` は ports の interface を、`index.ts` で同名の type 別名にして公開する。同名の値（モジュールオブジェクト）と並べるため。ports から `export type { AddressNormalizer }` で再 export すると値と衝突して型チェックが落ちる（TS2323）
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

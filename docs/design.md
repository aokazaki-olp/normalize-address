# normalize-address 設計

設計のメモ。コード・TSDoc と食い違うときは、それらを正とする（レイヤー構成と依存の向きを除く）。

日本の住所を正規化する。住所の解析は NJA（`@geolonia/normalize-japanese-addresses` 3.1.3）に任せ、建物部は、入力にガード付き NFKC をかけたテキストから切り出す。系列全体の設計と決定の経緯は作業場所の `docs/design.md` にある。

補助資料：[japanese-address-structure.md](japanese-address-structure.md)（住所の構造と訳語）、[nja-3.1.3-char-rules.md](nja-3.1.3-char-rules.md)（NJA 3.1.3 の文字の扱い）

## 公開 API

```ts
export const AddressNormalizer: AddressNormalizerFactory = { create };

interface AddressNormalizerFactory {
  // 住所の正規化器を作る。options は create のときに1回だけ検査・準備する
  create: (options?: AddressNormalizerOptions) => AddressNormalizer;
}

export interface AddressNormalizer {
  normalize: (input: string) => Promise<AddressResult>;
}

export interface AddressNormalizerOptions {
  style?: AddressStyle; // 字形の指定（下記）
  nja?: boolean; // true なら NJA の結果（手順2）を result.nja に入れる
  codes?: boolean; // true なら result.codes を入れる
}

export interface AddressResult {
  input: string; // 渡された文字列そのまま
  prefecture: string | null; // NJA の pref。読めなければ null
  city: string | null; // NJA の city（郡＋市区町村＋政令市の区）。読めなければ null
  town: string | null; // NJA の town（町字：大字・丁目・小字）。読めなければ null
  block: string | null; // NJA の addr（番地等：例 21-3（街区符号-住居番号）、または地番。形は下の block の項）。level 8 のときだけ入り、level 3 では null（番地は unmatched に残る）
  building: string; // 建物部。切り出さなかったときは ''（split を見る）
  unmatched: string; // データで確かめられなかった住所の残り（NJA の other にあたる）。無ければ ''
  level: AddressLevel; // NJA の level
  point: AddressPoint | null; // 位置情報。無ければ null
  split: 'found' | 'none' | 'unresolved' | 'skipped';
  codes?: { lgCode: string | null; machiazaId: string | null }; // codes が true のときだけ置く
  nja?: Readonly<Record<string, unknown>>; // nja が true のときだけ置く
}

export type AddressLevel = 0 | 1 | 2 | 3 | 8;

export interface AddressPoint {
  lat: number;
  lng: number;
  level: number;
}
```

- 読めなかった項目（`prefecture`〜`block`・`point`・`codes` の `lgCode`・`machiazaId`）は、省かずに `null` を置く。利用者が結果を ORM や DB にそのまま渡すため（ユーザーの決定）。たとえば Prisma では、値に `undefined` を渡すとその項目はクエリに含まれない（"if `undefined` is passed as a value, it is not included in the generated query"。Prisma ORM v7 の文書 `prisma.io/docs/orm/prisma-client/special-fields-and-types/null-and-undefined`、2026-09-28 確認）
- `building`・`unmatched` は `null` にせず文字列のまま。`unmatched` は無ければ `''`。`building` の `''` の意味は次の項のとおり `split` を見る
- `building` が `''` なのは、`split` が `'none'`（住所で終わっていて建物部が無い）のときだけではない。`'skipped'`（level 3 未満で切れ目を探さない）・`'unresolved'`（町字まで読めたが切れ目を決められなかった）のときも `''` で、建物部は `unmatched` に残る。利用者は `building` の `''` だけで「建物が無い」と判断せず `split` を見る。`split` の4つの値の意味と、そのときの `building`・`unmatched` は型 `SplitStatus` の TSDoc（名前では公開しない。`AddressResult['split']` で取れる）にも書く
- `split` が `'found'` で手順4（建物部の始まりの位置）で切ったときは、住所の項目・`level`・`point`・`codes` を前半の解析の結果から取り、`nja` は常に全体（テキスト）の解析の結果なので、`level` と `nja` の中の `level`、`block` と `nja` の中の `addr` が違うことがある（下の「出力の表」）
- `point.level` は NJA の型のまま `number` にする（結果の `level` の `AddressLevel` のように値を絞らない）
- `codes`・`nja` は、オプションが `true` のときだけ置く（`false` や省略のときは項目そのものが無い）

- 名前は NJA の分け方に合わせ、`pref` は正式な語 `prefecture` にする。`city`・`town` の中身は NJA の定義のまま
- `block` は NJA の `addr`。日本郵便の郵便番号・デジタルアドレス API の `block_name`（説明は「番地等文字列」、英語の説明は "block name"。API 仕様書 1.1.0.260723、2026-09-28 確認）に名前を合わせた。住居表示の地域では「街区符号-住居番号」（例 `21-3`）、地番の地域では地番（例 `3060-1`）。これは例で、住居番号だけのもの、住居番号2を含む3つ組、支号を含む地番（最大3つ組）もある（JAv2 の型で街区符号と住居番号2、地番2・地番3が省略できる）。地番の地域では、道路で囲まれた街区ではなく一筆の土地を指す。OSM の `addr:block_number` とは指すものが違う（英語版 wiki は道路で囲まれた区域の番号、日本語版 wiki は「街区符号または番地」で、住居番号・枝番号は `addr:housenumber` に分ける。2026-09-28 確認）。番地が住所データで確かめられたとき（level 8）だけ入る。level 3 では `null` で、番地は `unmatched` に残る
- `unmatched` は、データで確かめられなかった住所の残り。中身は NJA の `other`（NJA 3.1.3 の README の説明は「正規化できなかった文字列」）と同じ種類のものだが、建物部は `building` に切り出してある。`split` が `'skipped'`・`'unresolved'` のときは、建物部を含む残り全部が入る。名前は abr-geocoder 3.x の `unmatched_address`（3.0.51 で確認。照合できなかった部分。型は文字列の配列）と同じ語にした。日本郵便の API の `other_name`（説明は「その他住所文字列」、英語の説明は "Building number, room number, and other details"）と紛れないように `other` を使わない
- `nja` の中の `addr`・`other` は NJA の名前のまま（NJA の結果の写しなので変えない）
- 字形は、ガード付き NFKC（`@arihirookazaki/normalize-core`）をかけた後の文字列。`prefecture`〜`block` は NJA が返すマスターの表記
- 公開の型の TSDoc（`AddressStyle`）にも、`fields` の `false` でもガード付き NFKC はかかること（字形の指定だけを当てない）と、既定は ASCII の95字を半角にすることを書く（下記「字形の指定」）
- `codes.lgCode` は市区町村の全国地方公共団体コード（6桁の文字列）で、市区町村まで読めなければ `null`（都道府県のコードは入らない）。JAv2 の市区町村コードは数値で先頭のゼロが落ちているので、6桁にそろえる（札幌市中央区 `11011` → `011011`）。`codes.machiazaId` は町字 ID（7桁の文字列）
- `nja` は NJA の結果の写し（`structuredClone`）を入れる。NJA の結果の中には NJA のキャッシュのオブジェクト（`metadata.city` など）があり、そのまま渡すと利用者の書き換えが同じ読み込み単位の以後の結果に波及するため
- `nja` の型は `Readonly<Record<string, unknown>>` のままにする。NJA の版によって形が変わりうるので、スキーマを型に固定しない（規約 §2.7 の「スキーマが本当に存在しない場合は `unknown` のまま」）
- 公開する値は `AddressNormalizer`（モジュールオブジェクト、規約 §2.1）と `NormalizeAddressError` だけ。型は `AddressNormalizer`・`AddressNormalizerOptions`・`AddressResult`・`AddressStyle`・`AddressLevel`・`AddressPoint` と、normalize-core の `CharStyle`・`CharTarget`・`WidthMode` を再公開する。関数（`applyCharStyle` など）は再公開しない。`SplitStatus` は利用者が名前で使う必要が無いので公開の型に入れない（`AddressResult['split']` で取れる）
- `create` は options を1回だけ検査・準備する（字形の指定の検査と、`default` と項目ごとの指定のマージ）。options が検査を満たさなければ `create` が `TypeError` を投げ、`normalize` は呼ぶ前から使えない。準備したものは写しなので、`create` のあとで options を書き換えても正規化器には効かない
- 公開の interface の関数はプロパティの形で宣言する（利用者の lint の unbound-method に当たらないように。実装は this を使わないので、取り出して渡してよい）。非公開の `AddressParser.parse` も同じ形にそろえる
- 値の `AddressNormalizer` は ports の `AddressNormalizerFactory`（`create` を持つ interface。TSDoc はそのメンバーに付ける）で型を注釈する。短縮記法の `{ create }` に付けた TSDoc は tsc が出力する `dist/index.d.ts` に届かないため。`AddressNormalizerFactory` は利用者が名前で使う必要が無いので公開の型に入れない（`typeof AddressNormalizer` で取れる）
- NJA の設定・取得処理の差し替え（下記「失敗の扱い」）・住所データのキャッシュはモジュールの読み込み単位に1つ（worker_threads の worker ごとに別）で、`create` を何回呼んでもすべての正規化器で共有される。取得先（エンドポイント）などは `create` の引数に入れない
- `create` の入力の誤り（options が object でない、`nja`・`codes` が boolean でない、字形の指定が検査を満たさない）と、`normalize` の入力の誤り（引数が文字列でない）は `TypeError`。それ以外で処理を終えられなかったもの（住所データの取得の失敗、NJA の処理の失敗）は `normalize` が `NormalizeAddressError` を投げる。原因は `url`・`status`・`cause` を見る（下記「失敗の扱い」）

## 処理の流れ

1. 入力にガード付き NFKC をかけ、住所の番号の中にある空白を消し、NJA が読み誤る書き方を書き換える（以下、これを「テキスト」と呼ぶ）。消すのは次の空白だけで、ほかの空白は利用者が入れた住所と建物の境目として残す
   - 横棒のまわり：数字と数字の間の横棒の前後（`4-13- 9`、`3-18 -5`、`1 - 1`）。ただし横棒のあとの番号に `号館` `号舘` `号棟` `番館` `号室`（空白をはさんでもよい）、`棟` `館` `舘` `室`（番号の直後だけ。空白のあとは `室町` などの建物名と区別できない）、英字と `棟` `館`（番号の直後だけ）が続くときは、住所と建物の区切りとして残す（`5 - 1号館`）
   - 左が数字と `番`（`番地` でない）で、右が `号` で閉じた番号 `M号`・`M-K号`（`号室` `号棟` `号館` `号地` を除く）。住居表示の「○番○号」「○番○―○号」の住居番号（`5番 17-103号`）
   - 左が数字で、右が接尾語 `号` `番地` `番` だけ（あとが末尾・空白・数字・`外` `先` `内`）（`19番5 号`、`2180-1 番地外`）

   数字と数字の間の空白（`1-9-9 1階`、`118番地 1階`）は消さない。消すと番号がつながり、番地のデータと偶然に一致することがある（`118-1`）

   書き換えは次の3つ（`rewrites.ts`）
   - 京都市（`京都府` を付けたもの、空白をはさんだものを含む）で始まる入力で、区のあとの最初の通り名（`…上る` `…上ル` `…下る` `…下ル` `…東入(る|ル)` `…西入(る|ル)`。`西入口` は除く）と、それに続く `N丁目`（筋の数。あとの `上る` などを含む）を、区と通り名の間に空白・数字・番号の形の漢数字（番・号・の・丁・横棒が続くもの、条の付かない2字以上）が無く、あとに空白・数字でない字が続くときだけ外す。NJA 3.1.3 は京都市の町字を先頭で照合できないと途中の位置でも照合するので、通り名を残すと建物名の中の町名（`月鉾町ビル`）や交差する通りの名前と同じ町字（`竹屋町`）に当たって番地が消える。`N丁目` を残すと `二番町` などの町字に読む。外した通り名は結果のどの項目にも残らない。外したときと外さないときの読みは比べない（全データの京都市の1,455行で、外さないほうが正しかったのは `N丁目` を残した形だけで、比べると交差する通りの町字を採る誤りが19行出た）
   - `、` または `及び` のあとの `N番地M` を `N-M` にする。NJA 3.1.3 の後処理が `N番地` を `N` にして、列挙の2つ目の番号がつながる（`、1444番地1` → `、14441`）。`・` `.` の列挙は、列挙の判定（手順7）が `番` `地` の語を手がかりにするので変えない
   - `および` を `及び` にする（列挙の語にそろえる）

2. テキスト全体を NJA にかける。テキストが都道府県の無い同じ名前の市区町村（`府中市`・`伊達市` など、都道府県の異なる25組。`prefectureCandidates.ts`）で始まるときは、候補の都道府県を前に付けて1つずつかけ、level、町字の長さ、`unmatched` の短さの順で最も良いもの（同点が無いとき）を採り、そのテキストで手順3以降を行う。同点なら都道府県を付けずにかける。NJA 3.1.3 は都道府県が無いと、町字まで読めた同じ名前の候補の最後を採る（`府中市府中町一丁目` を広島県と読む）
3. level が 3 未満なら、切れ目を探さない（`split: 'skipped'`、`building: ''`）
4. 建物部の始まりの位置の候補（下記「建物部の始まりの位置」）を順に試す。候補の位置で切った後半から `building` を取り出し（手順7と同じ）、空か、階・部屋の数字を番地に取った残りの印（手順6）なら次の候補へ。空でなければ前半を NJA にかけ、次の受け入れ条件をすべて満たせば切る（`split: 'found'`）。条件の名前は、コードの述語とテスト名の接頭辞にも使う（括弧の中はコードでの名前）
   - **地域一致**（`isSameArea`）：都道府県・市区町村・町字が全体の結果と一致する
   - **level 3 以上**（`hasAddressLevel`）：前半の level が 3 以上
   - **末尾あり**（`hasFrontTail`）：前半の住所の末尾（手順7）が空でない
   - **読み切り**（`readsThrough`）：前半が住所として読み切れている。全体の住所の末尾（手順5）が空でないなら、前半の `other`（前後の空白を除く）が空か `^[0-9]+((-|番地の|番地|番の|番-|番|号|の|ノ|街区|区)[0-9]+)*(号|番地先|番先|番地|番|地先|地)?$` に当たる（前半が level 8 なら空か住所の接尾語だけ（`2番先` の前半で NJA が返す `番先`）。数字の間に `番` `の` `号` `街区` `区` などが残るのは、NJA が level 3 で番地を読み切れず `other` に残した形：`2番-21号`、`16号7`、`1街区1号`、`87区654-3`）。全体の住所の末尾が空（NJA の町字の判定が途中で止まった入力）なら、全体の `other`（前後の空白を除く）が前半の `other`（同）で始まり、前半の `other` が数字か住所の接尾語（手順5）で終わる
   - **続きでない**（`doesNotContinue`）：`building` が住所の続きで始まらず、全体が住所の続きだけ（手順7）でもない。`^(番地先|番先|番地|番|号|地先|地|[のノ])(?=[0-9])` に当たるもの、`線` で始まるもの、後半の先頭に横棒（手順7）があり、それを落とした `building` が数字で始まるのに階の形（`^[0-9]+(階|F(?![A-Za-z]))`）でも部屋番号の形（`^[0-9]+(号室|室)`）でもないもの（`1ー87ー6FKハイツ` の `ー6FK…` は番地の続き）は受け入れない
   - **番地の保持**（`keepsWholeNumber`）：データで確定した番地を上書きしない。全体が level 8 で前半の level が 8 未満なら、次のどちらかのときだけ受け入れる
     - `building` が漢数字で始まる（建物名の先頭の漢数字を NJA が番地に読む形）
     - 後半が利用者の入力した空白で始まり、かつ `building` の先頭の数字が全体の番地の続きでない（全体の住所の末尾が、前半の住所の末尾と `building` の先頭の数字を `-` でつないだものと一致しない）。ただし `building` がはっきりした階の形（`^[0-9]+(階|F(?=$|[\s0-9・、,(]))`）なら番地の続きとみなさない（`岩瀬30番地 1階` は 30 と `1階`）。F は直後が末尾・空白・数字・`・` `、` `,` `(` のときだけ階とする（`16-12F&Gビル`、`2-22Fビル1F` のように F が建物名の一部になる形を階と読まないため）

     階の形でも、空白の無い `-3F` `-2階` はこの例外に入れない。前半（短い番地）が level 8 未満になるのは短い番地が住所データに無いときで、そのときは長い番地が正しかった（`北一条西5-1-3F` は 5-1-3 が level 8、5-1 が level 3）

   - **番号の上限**（`exceedsNumberLimit`）：前半が level 8 未満なら、前半の `other` の先頭の番号の並びが、手順5の上限で短くならない。並びが `other` の末尾まで続くときは、後半の先頭を並びの直後として見る

   受け入れ条件のどれかを満たさなければ次の候補へ進み、候補が尽きたら手順5へ進む

5. 住所の末尾を決める。level 8 なら NJA の `addr`、level 3 なら NJA の `other` の先頭の番号の並び（`^[0-9]+((-|番地の|番地|番の|番-|番|の|ノ|街区|区)[0-9]+)*`）から、次の順に後ろを外し、区切りを `-` にそろえたもの。外した部分は残りに回す
   - 番号が2つ以上あり、並びの直後が `階`、英字が続かない `F`、`号室`、`室` なら、最後の番号を外す。ただしテキストで最後の番号が空白をはさんで階の数字に続く（NJA が空白を消して1つの番号にした）なら、階の数字の分だけを外す
   - 区切りが `区` で終わる番号（ブロック地番の街区）までは数えず、そのあとの番号を2つまで取る。3つ目は、1〜2桁か、テキストで直前のつなぎが `の` `ノ` で終わる（`番地の` `番の` を含む。筆の続き）なら取る。それより後ろは外す。NJA は `other` の `の` を `-` に変えるので、つなぎはテキストで見る（算用数字・漢数字を同じ値として読み、町字に最も近い箇所を見る）

   住所の末尾が空でなく、その直後（level 8 なら `other` の先頭）に住所の接尾語 `号` `番地先` `番先` `番地` `番` `地先` `地` のどれか（この順で最初に当たるものを1回）が続くなら、それも住所の末尾の一部として残りから除く。テキストの残りが無ければ `split: 'none'`

6. 切れ目の候補を前から順に試し、その位置までの前半を NJA にかける。地域一致（手順4）を満たし、前半の住所の末尾（手順7）が全体の住所の末尾（手順5）と一致した最初の位置で切る（`split: 'found'`）。後半が `building`。`building` が住所の続きだけ（手順7）なら切らずに `split: 'none'`。切れ目の直前が利用者の空白でなく、`building` が数字の無い階・部屋の印（`階`、直後が末尾・空白・`・` `、` `,` `(` の `F`・`号室`）で始まるなら、切らずに `split: 'unresolved'`（下の階の1桁の移し替えに当たるときを除く）。階・部屋の数字を番地に取った残り（`32-1F` で番地のデータに `32-1` があり `32` が無いとき、番地の保持で長い番地を採る）で、建物部と決められないため
   - 全体が level 8 未満で、一致した位置の後ろが空白なしの `階` か英字の続かない `F` だけで、前が2桁以上の数字で終わり最後の1字が `0` でないなら、1字前の位置で切った前半を NJA にかける。前半が level 8 で、地域が一致し、前半の住所の末尾が全体の住所の末尾から最後の1字を除いたものと一致すれば、そこで切る（最後の1桁を階に回す）
   - 切れ目の候補は、テキストの先頭と末尾を除く位置のうち、次のどちらかに当たるもの
     - 直前が `号` `地`（直後の字を問わない）
     - 直前が数字・漢数字・`番` `目` で、直後が数字・`号` `番` `地` のどれでもない
7. 手順4と6で使う定義
   - 前半の住所の末尾は、NJA の `addr` と、`other` の末尾の住所の接尾語（手順5。1回）を落としたもの（先頭の番号の並びの区切りを `-` にそろえる）を、空でないものだけ `-` でつないだもの
   - 住所の続きだけ（`isAddressOnly`）は、`building` の全体が地番の列挙・合併・枝番（`、N番地`、`・N番合地`、`甲N`、`第N` など。`番` `地` `合` `甲乙` `及び` などの住所の語を含むか、`、` で始まる番号の列挙だけ。番号の前の地名は `字` のあとか `N番地` が続くときだけ、`号` は `N番N` のあとだけ。`第N` だけなら、切れ目の前が `N番地`・`N番` のときだけ）か、範囲の接尾語（`番地先` `番先` `番地内` `地先` `地内` `の内` `先` `内` `外` のどれか1つ）だけのもの。列挙・合併・甲乙の枝番・範囲の接尾語は住所の一部で、建物ではない
   - `building` は、後半の前後の空白を落とし、先頭の横棒（NJA 3.1.3 が横棒として扱う字。normalize-core の `HORIZONTAL_BAR_PATTERN` の字の集合で、長音 `ー` を含む。続いていればすべて）を落とし、さらに前後の空白を落としたもの。建物名が `ー` で始まることは実質ないと判断した。手順6でこれが空になったら `split: 'none'`、`building` は `''`、`unmatched` は全体の結果（NJA の `other`）のまま
8. 一致する位置が無ければ `split: 'unresolved'`（手順4で、住所の続きだけの後半のほかは受け入れ条件を満たす候補があったなら `split: 'none'`）。`building` は `''`、`unmatched` は全体の結果（NJA の `other`）のまま

出力の項目は次の結果から取る。列は domain の `split/outcome.ts` で切れ目の探索の結果（`SplitOutcome`）を作る関数に1対1で対応する。`SplitOutcome` の `fieldsFrom` が、住所の項目・level・point・codes を取る解析の結果

| 項目                                             | `foundAtBuildingStart`（手順4で切った） | `foundAtCandidate`（手順6で切った）                                     | `unsplit`（切らなかった：`skipped`・`none`・`unresolved`） |
| ------------------------------------------------ | --------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- |
| `prefecture`〜`block`・`level`・`point`・`codes` | 前半の結果                              | 全体の結果（手順2）。全体が level 8 未満で前半が level 8 なら前半の結果 | 全体の結果（手順2）                                        |
| `unmatched`                                      | 前半の結果                              | 前半の結果                                                              | 全体の結果（手順2）                                        |
| `building`                                       | 後半から取り出したもの（手順7）         | 後半から取り出したもの（手順7）                                         | `''`                                                       |
| `nja`                                            | 全体の結果                              | 全体の結果                                                              | 全体の結果                                                 |

どの結果から取っても、その結果で読めなかった項目は `null` にする（「公開 API」）。`codes`・`nja` はオプションが `true` のときだけ置く。

手順4で前半の結果を使うのは、全体の結果が NJA の誤読を含みうるため（建物名の先頭の漢数字を番地に読む、空白を消して後ろの数字を番地につなげる）。

## 建物部の始まりの位置

abr-geocoder 3.0.51（`github.com/digital-go-jp/abr-geocoder`、タグ `3.0.51`、コミット `4a466ed40b65b658368ef3614eafd1709ac83a86`）の Go 実装 abrg は、照合の前に正規表現で住所の番号をハイフンの形にし、建物部の前に空白を入れ、照合には最初の空白より前だけを使う。この切り分けの規則を domain 層に移植し、建物部の始まりの位置を求めるためだけに使う。NJA には整えた文字列を渡さず、テキストをその位置で切る。

候補は次の順に最大2つ（同じ位置は1つにまとめる。テキストの先頭と末尾は除く）。

1. abrg の規則：テキストの写しに下の「移植した処理」をかけ、その結果で最初の算用数字より後ろにある最初の空白の、後ろの部分を建物部とする。利用者が入れた空白も規則の出力に残るので、最初の算用数字より後ろの最初の空白は同じように候補になる（`東京都 千代田区 …` のように算用数字より前の空白は候補にしない）
2. abrg に無い独自の規則：写しの中で、ハイフンでつないだ3つ以上の番号のあとに `-` と `N号室` または `N室` が続くとき（`(?<![0-9-])[0-9]+(-[0-9]+){2,}-[0-9]+(号室|室)` の最初の一致）、その最後の `-` の位置。部屋番号を明示しているので建物部にする（`清川2-5-8-907号室` → `907号室`）

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
- 未知のキーを検査するのは `fields` のキーだけで、options や `style` のほかのキーは検査しない（TypeScript の型検査で防げる。実行時の検査をそろえるには normalize-core も変える必要があるので、規約 §5.4 の例外とする）

## 失敗の扱い

例外は2種類に分ける。

- `TypeError`：入力の誤りだけ（このライブラリの不具合を除く。`create` の options が検査を満たさない、`normalize` の引数が文字列でない）。同じ入力で再試行しても同じ
- `NormalizeAddressError`：それ以外で、正規化器が処理を終えられなかったもの（住所データの取得の失敗、NJA の処理の失敗）。原因は `url`・`status`・`cause` を見る（下の表）。このライブラリの不具合の例外は包まず、そのまま出る。一時的な失敗（ネットワークの失敗、本文の途中の切断など）を含むので、再試行してよい。同じ失敗が続くこともある。取得の失敗かどうかの見分け方は作らない

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
| NJA がそのほかの例外を投げた（取得した本文の読み取りの失敗など）                                      | なし  | なし     | 元の例外 |

NJA 3.1.3 は取得した応答が正常かを確かめず、住居表示・地番のデータでエラーが返ると例外にならずに level 3 に落ち、その結果がキャッシュされる。NJA が公開している `requestHandlers.http` を差し替え、上の取得の失敗を検査して `NormalizeAddressError` を投げる。取得処理が投げた例外もここで包む（包まないと `TypeError` として出て、入力の誤りと区別できない）。

NJA は応答の本文を取得処理の外で読む（NJA 3.1.3 の `dist/main-node-esm.mjs` の 503・551・566・939 行）ので、本文の途中の切断（`TypeError: terminated`）、2xx で本文が JSON でない（`SyntaxError`）、形の違う JSON（`TypeError`）、`file://` の取得先が無い（`ENOENT`）、未知のスキーム（`Error`）などは取得処理の差し替えでは包めない。そのため adapters の AddressParser で、NJA の `normalize` が投げた例外のうち `NormalizeAddressError` でないもの（判定は `name`）を、すべて `NormalizeAddressError` で包む（`url`・`status` は `undefined`、`cause` に元の例外）。私たちの domain・application の不具合で出る例外は包まない（NJA との境界の外なので）。

`requestHandlers` はモジュール全体で1つなので、差し替えは最初の解析の前に1回だけ行う。`create` を何回呼んでも差し替えは1回で、すべての正規化器が同じ取得処理と住所データのキャッシュを使う。同じ読み込み単位で NJA を直接使う別のコードがあれば、その挙動も変わる。

## レイヤーと依存の向き

```
src/
  index.ts       公開面。NJA の AddressParser を1つ作り、それを使う create を AddressNormalizer として公開する
  application/   処理の流れ（手順1〜8）。ports の AddressParser だけを通して解析する
  domain/        純粋な処理（options の検査と準備、同じ名前の市区町村の都道府県の候補、切れ目の候補、建物部の始まりの位置と abrg の規則の移植、住所の末尾、結果の比較と組み立て）
  ports/         インターフェース（AddressParser、AddressNormalizer、AddressNormalizerFactory）と型だけ
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
- ports の `ParsedAddress` の項目名は結果と同じ `block`・`unmatched` にする（同じ概念に別の名前を並べない）。NJA の `addr`・`other` から写すのは adapters だけ。読めなかった項目も結果と同じく `null` にし、NJA の `undefined` を `null` にそろえるのは adapters だけ
- `AddressLevel`・`AddressPoint` は結果の型なので ports の `addressResult.ts` に置き、`ParsedAddress` はそれを使う
- `src/` の直下に置くのは `index.ts` だけ（ほかは層のディレクトリに置く）。lint の層の検査は層のディレクトリのファイルにしか掛からないため、テストで確かめる
- application は `createAddressNormalizer(parser, options)` で正規化器を作る。`index.ts` の `create` はこれに NJA の AddressParser を渡すだけ
- `index.ts` は依存を組み立てる唯一の場所なので、解析器の生成と `create` の定義（2行）を置く（規約 §2.5「`index.ts` に内部実装を並べない」の例外）
- ports の `AddressParser` には、投げる例外の取り決めを書かない。非公開の内部の依存で、例外の分類は adapters の境界（`njaParser.ts`）で行うため
- 表で `application`・`domain` に `@arihirookazaki/normalize-core` の import を許すのは、normalize-core が系列の共通基盤で I/O を持たず、AGENTS.md の「外部ライブラリと I/O」に当たらないため（作業場所の `docs/design.md` の決定「`normalize-core` は I/O を持たないので、`domain` から import してよい」）
- 型の `AddressNormalizer` は ports の interface を、`index.ts` で同名の type 別名にして公開する。同名の値（モジュールオブジェクト）と並べるため。ports から `export type { AddressNormalizer }` で再 export すると値と衝突して型チェックが落ちる（TS2323）
- テストでは、決まった結果を返す偽の `AddressParser` を注入すれば、NJA もネットワークも使わずに手順1〜8を確かめられる。取得の失敗の判定は、偽の取得関数を渡して確かめる

`domain/split/` は、住所部と建物部の切れ目を決める処理を関心事ごとに分けたもの。domain の外からは各ファイルを直接 import する（束ねるファイルは置かない）。

| ファイル           | 関心事                                                                                        | 手順                          |
| ------------------ | --------------------------------------------------------------------------------------------- | ----------------------------- |
| `rules.ts`         | 規則のデータ（住所の接尾語・漢数字・横棒・階の形など）と、それから組み立てた正規表現          | 4〜7                          |
| `buildingStart.ts` | 建物部の始まりの位置の候補（abrg の規則の出力から元のテキストの位置への対応づけ、独自の規則） | 4（「建物部の始まりの位置」） |
| `acceptance.ts`    | 手順4の受け入れ条件と、手順6の前半が全体と同じ住所を指すかの判定                              | 4・6                          |
| `addressTail.ts`   | 全体の住所の末尾と残り、前半の住所の末尾、番号の上限（手順4の受け入れ条件）                   | 4・5・7                       |
| `candidates.ts`    | 切れ目の候補                                                                                  | 6                             |
| `building.ts`      | 後半から `building` を取り出す                                                                | 7                             |
| `spaces.ts`        | 住所の番号の中にある空白を消す                                                                | 1                             |
| `rewrites.ts`      | NJA が読み誤る書き方を書き換える（京都市の通り名、列挙の番地、`および`）                      | 1                             |
| `outcome.ts`       | 切れ目の探索の結果（出力の表のどの結果を使うか）                                              | 3〜8                          |

`acceptance.ts` は `rules.ts`・`addressTail.ts` を、`addressTail.ts`・`building.ts`・`candidates.ts`・`buildingStart.ts`・`spaces.ts`・`rewrites.ts` は `rules.ts` を import する（`buildingStart.ts` は split/ の外の `abrgNormalize.ts`・`trackedText.ts` も）。循環させない。

## 依存

- `@geolonia/normalize-japanese-addresses` は `3.1.3` に固定する（2026-09-27 時点で npm の最新）
- abr-geocoder 3.0.51 の規則はコードとして移植しており、依存には入れない。移植したファイルとテストの固定データは、リポジトリ直下の `THIRD_PARTY_NOTICES.md` に著作権表示と MIT の許諾文とともに列挙し、配布物にも入れる
- `@arihirookazaki/normalize-core` は Git の URL で書き、`bundleDependencies` で同梱する。開発中は手元のリポジトリ（`git+file:`）を指し、契約の調整のときに GitHub の URL（`github:aokazaki-olp/normalize-core#<コミット>`）に切り替える

## 既知の制限

- NJA の誤認はそのまま出る（京都の通り名での町字の誤り、`字` の扱いなど）
- マスターが NFKC で変わる字形で登録されている町字は一致しなくなる（`蝉ｹ平`、全角括弧の町字など）
- level 3 では、3つ目が1〜2桁の部屋番号（`3-1-21`）と、番号と空白なしにつながった2桁以上の階は、番地と区別できない（最後の1桁だけを階に回す）
- 地番の列挙のあとに空白と建物名が続く形は、建物部が列挙から始まる。level 8 で列挙を住所部に残すとき（`none`）、`unmatched` は NJA の `other` のまま
- 建物部の始まりの位置の候補は最大2つだけ（「建物部の始まりの位置」）。abrg の規則の出力で最初の算用数字より後ろの最初の空白と、abrg に無い独自の規則（ハイフンでつないだ3つ以上の番号の後ろの `-N号室`・`-N室`）。どちらの前半も手順4の受け入れ条件を満たさなければ、手順6の探索に戻る
- 住所データは Geolonia の API から取得する
- 横棒の前後の空白を消すとき、区切りとして空白を残す棟・館・部屋の印は一覧にあるものだけ（手順1）。一覧に無い書き方（`112B号室` のように英字の付いた部屋番号、`番舘`、`東棟` のように方角の付いた棟）は印とみなさず、横棒のあとの番号を番地に含める（全データでは、空白をはさんだ横棒と組み合わさる行は0行）
- 京都市の通り名を外す規則は字面の規則なので、町名を通り名より前に書いた形（`笋町五ノ一烏丸通四条上る…`）では町名や番地まで外しうる（全データでは0行）。通り名に続く `N丁目` は、あとが算用数字・空白でなければ外すので、中京区の町字 `五丁目`・`六丁目` を漢数字の番号や建物名と空白なしで続けると町字ごと外れる（全データでは0行）
- 同じ名前の市区町村の一覧（手順2）は、JAv2 の `ja.json`（`meta.updated` 1735102668）から写したもの。住所データの更新で市区町村が変わっても追従しない
- 外字（Unicode の私用領域 U+E000〜U+F8FF の字）を含む入力は、NJA が町字を読めず level 1〜2 で止まることがある（試験で 278件）。元の字は外字の対応表が無いと分からないので、こちらでは直さない
- NJA の設定（`config`）や `requestHandlers` を利用者が直接書き換えることは想定しない。書き換えると取得の失敗の検査が外れうる（差し替えは最初の解析の前に1回だけ行う）
- NJA の状態（設定・取得処理の差し替え・住所データのキャッシュ）はモジュールの読み込み単位で、worker_threads の worker ごとに別
- `normalize` は `AbortSignal` を受け取らず、呼び出しを途中で打ち切れない。NJA 3.1.3 の `normalize` に signal を渡す API が無いため（オプションは `level` と `geoloniaApiKey` だけ。規約 §5.3 の例外）
- 配信側（あいだのキャッシュ・プロキシを含む）が誤ったデータを返すと、NJA 3.1.3 はそれを確かめずに使ってキャッシュすることがあり、誤った結果（別の町字の位置を成功として返すことを含む）や失敗が続くことがある。配信側の障害のときに限られ、adapters からは網羅的に確かめられないので、記録だけにする（規約 §5.4・§1 の例外。ユーザーの決定）
- `unmatched` は NJA の `other` をもとにしているので、NJA 3.1.3 の変換（空白・横棒・数字の表記など）がかかり、入力の字のままではない。変換の中身は `nja-3.1.3-char-rules.md` の層1（P1〜P6）と層4にだけ書き、ここには写さない。例：`東京都中央区ニュー八重洲ビル10階` は level 2・`skipped` で、`unmatched` は `ニュ-八重洲ビル10階`。`building` は NJA の変換を受けない。`skipped`・`unresolved` では建物名が `unmatched` に残り、この変換を受ける。記録だけにする（ユーザーの決定）

## 今回やらないこと

部屋番号の判定、タブ・改行の扱い、建物部を入力の字のまま返すこと

# 固定したバージョンとその理由

規約 §8.1 の「固定した版とその理由は `package.json` の隣に書く」に対応する。確認日は 2026-09-27。

## Node — `^24.12.0 || >=25.2.0`

型注釈の除去が stable になった版を下限にする。v24.12.0 と v25.2.0 のリリースノートに「mark type stripping as stable」がある（v25.0.0・v25.1.0 には無い）。

- https://nodejs.org/en/blog/release/v24.12.0
- https://nodejs.org/en/blog/release/v25.2.0

## @types/node — `~24.12.0`

`engines` の下限に合わせる。新しい版の型を入れると、24.12 に無い API が型チェックを通ってしまう。

## TypeScript — `6.0.3`（キャレットなし）

最新は 7.0.2 だが、typescript-eslint 8.70.1 の peerDependencies が `typescript: >=4.8.4 <6.1.0` で、型情報を使う lint が 7 では動かない。規約 §8.1 の「型情報を使う lint が動く組み合わせを選ぶ」に従う。typescript-eslint が 7 に対応したら固定を外し、§8.3 の確認をやり直す。

## @geolonia/normalize-japanese-addresses — `3.1.3`（キャレットなし）

2026-09-27 時点で npm の最新（`npm view @geolonia/normalize-japanese-addresses version` → `3.1.3`、`dist-tags.latest` も `3.1.3`）。

この版の内部の挙動に依存しているので固定する。版を上げるときは、次を実物で確かめ直す。

- `requestHandlers` を export し、取得のたびに `requestHandlers.http(url, options)` を参照する（差し替えが効く）。住居表示・地番の `.txt` は `options` に `offset` と `length` を渡す範囲指定の取得で、応答のステータスを確かめない（`dist/main-node-esm.mjs`）
- 結果の `metadata.city.code` が数値で、`metadata.machiAza.machiaza_id` が文字列（`@geolonia/japanese-addresses-v2` 0.0.5 の型）
- 文字の扱い（[docs/nja-3.1.3-char-rules.md](docs/nja-3.1.3-char-rules.md)）

# Third-party notices

このパッケージには、次のソフトウェアに由来する部分が含まれる。

## abr-geocoder 3.0.51

- 出典：https://github.com/digital-go-jp/abr-geocoder （タグ `3.0.51`、コミット `4a466ed40b65b658368ef3614eafd1709ac83a86`）
- ライセンス：MIT License

由来するファイル：

- `src/domain/abrgNormalize.ts`（`abrg/internal/normalize` の `address_hyphen.go`・`address_type.go`・`normalize.go`・`pipeline.go`・`dash.go`・`whitespace.go`・`punctuation.go` の規則を TypeScript に移植したもの）
- `tests/domain/abrgNormalizeCases.ts`（`abrg/internal/normalize` の `address_hyphen_test.go`・`address_type_test.go`・`normalize_test.go`・`pipeline_test.go` のテストの入力と期待値）
- ビルドした配布物のうち、`src/domain/abrgNormalize.ts` から作られた `dist/domain/abrgNormalize.js` と `dist/domain/abrgNormalize.d.ts`

```text
MIT License

Copyright (c) 2026 Digital Agency of Japan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

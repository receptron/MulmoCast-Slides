# feat: ExtendedMulmoScript → ExtendedMulmoViewerData（データ処理）

## 背景

ExtendedMulmoScript（variants, meta, scriptMeta, outputProfiles）の情報が、bundle生成時に失われている。
`mulmoViewerBundle()` は基底の `MulmoViewerData` のみを出力し、拡張フィールドは全て破棄される。

これを解決し、`mulmo_view.json` に拡張フィールドを含める。
将来的に Vue viewer でプロファイル切替・フィルタ・対話的Q&A をブラウザ上で実現するための基盤。

## 実装内容

### 新規: `src/utils/extended-bundle-merge.ts`

`mulmoViewerBundle()` が生成した `mulmo_view.json` に、`extended_script.json` から拡張フィールドをマージする。

- 入力: `bundleDir`（mulmo_view.json のあるディレクトリ）、`scriptsDir`（extended_script.json のあるディレクトリ）
- beat はインデックスで対応付け（preprocessor のデフォルトプロファイルでは順序が保持される）
- 各 beat に `id`, `variants`（text/skip のみ）, `meta` をコピー
- トップレベルに `outputProfiles`, `scriptMeta` をコピー
- `extended_script.json` が存在しない場合は何もしない（後方互換）
- 型: `ExtendedMulmoViewerData` / `ExtendedMulmoViewerBeat` は `@mulmocast/extended-types` から import

### 変更: `src/actions/bundle.ts`

`mulmoViewerBundle()` の後に `mergeExtendedMetadata()` を呼び出す。

### テスト: `tests/test_extended_bundle_merge.ts`

- beat 数が一致する場合のマージ
- extended_script.json がない場合（no-op）
- 既存フィールド（audioSources, imageSource等）が保持されること

## 検証

1. `yarn build`
2. `yarn test`
3. `yarn lint`

# Markdown → ExtendedMulmoScript 変換パイプライン

Issue: #78

## 概要

外部スキルが生成した構造化Markdownを、ExtendedMulmoScript形式に変換するパイプライン。
LLM（Claude Codeスキル）が内容を分析し、プレゼンに必要な情報だけをbeatに配置、
それ以外をメタ情報として構造化する。

## パイプライン

### Step 1: スキーマ生成 + Markdown構造解析（コード、毎回実行）

- `z.toJSONSchema(extendedMulmoScriptSchema)` を毎回実行し最新JSON Schema生成
- Markdownを機械的にパース → `parsed_structure.json`
- 中間形式JSON Schemaから `z.fromJSONSchema()` でバリデータ生成

### Step 2: プレゼン設計（LLMスキル）

- `parsed_structure.json` + JSON Schemaを入力
- beat分割、コンテンツ配置、メタ情報、core/optional判定
- → `presentation_plan.json`

### Step 3: ExtendedMulmoScript組み立て（コード）

- `presentation_plan.json` → `extended_script.json`
- `isCore` / `shortNarration` → `variants` / `outputProfiles` 変換

### Step 4: バリデーション（コード）

- `extendedMulmoScriptSchema.safeParse()` で検証

## 実装成果物

- `src/utils/markdown-parser.ts` — MD構造解析
- `src/actions/md-to-extended.ts` — スキーマ生成 + 組み立て + 検証
- `references/presentation-plan.schema.json` — 中間形式の定義
- `.claude/skills/md-to-mulmo/SKILL.md` — LLMスキル
- CLI: `parse-md`, `assemble-extended` コマンド

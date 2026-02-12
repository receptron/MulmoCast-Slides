# チュートリアル: Markdown からナレーション付き動画を作成する

Markdown ドキュメント（技術文書、ブログ記事、仕様書など）を、AI が構成を設計しナレーションを付けた動画に変換する手順です。作成した ExtendedMulmoScript に対して、対話的に質問することもできます。

## 事前準備

- Node.js 20 以上
- [Claude Code](https://claude.com/claude-code)（`/md-to-mulmo` スキルで使用）
- OpenAI API キー（環境変数 `OPENAI_API_KEY`）

```bash
# MulmoCast-Slides をインストール
npm install -g @mulmocast/slide

# インストール確認
mulmo-slide --help
```

## セットアップ

### 1. プロジェクトディレクトリを作成

```bash
mkdir my-md-project
cd my-md-project
```

### 2. API キーを設定

`.env` ファイルを作成して API キーを記述します：

```bash
cat <<'EOF' > .env
OPENAI_API_KEY=sk-your-openai-api-key
EOF
```

- `OPENAI_API_KEY`: 音声合成（TTS）と動画生成に使用

### 3. Markdown ファイルを配置

変換したい Markdown をプロジェクトディレクトリにコピーします：

```bash
cp /path/to/your-document.md .
```

### 4. Claude Code スキルをインストール

```bash
mulmo-slide extend init
```

これで `.claude/skills/` にスキルファイルがコピーされます。

## クイックスタート（コピペで実行）

```bash
# Claude Code 内で実行:
/md-to-mulmo your-document.md
```

これだけです！ `/md-to-mulmo` スキルが自動的に：
1. Markdown の構造を解析（`parse-md`）
2. セクション・見出し・コードブロック等を抽出
3. LLM がプレゼンテーションプランを設計
4. ExtendedMulmoScript を組み立て（`assemble-extended`）
5. `detailed`（完全版）と `short`（要約版）の出力プロファイルを生成

## `/md-to-mulmo` が生成するもの

```
scripts/your-document/
  parsed_structure.json           # Markdown のパース結果
  extended-script.schema.json     # ExtendedMulmoScript のスキーマ
  presentation-plan.schema.json   # プレゼンプランのスキーマ
  presentation_plan.json          # LLM が作成したプレゼンプラン
  extended_script.json            # ExtendedMulmoScript（ナレーション + メタデータ）
```

## `/md-to-mulmo` 後の次のステップ

### 内容に対話的に質問する

ドキュメントについて質問できます：

```bash
npx mulmocast-preprocessor query scripts/your-document/extended_script.json -i
```

実行例：
```
> このドキュメントの主題は何ですか？
マイクロサービスアーキテクチャの設計パターンについて解説しています...

> 推奨されるデプロイ戦略は？
1. Blue-Green デプロイメント
2. カナリアリリース
3. ローリングアップデート

> exit
```

一つの質問だけ聞く：
```bash
npx mulmocast-preprocessor query scripts/your-document/extended_script.json "主なポイントは何ですか？"
```

要約を生成する：
```bash
npx mulmocast-preprocessor summarize scripts/your-document/extended_script.json -l ja
```

### ナレーション付き動画を生成する

ExtendedMulmoScript をクリーンな MulmoScript に変換してから動画を生成します：

```bash
npx mulmocast-preprocessor scripts/your-document/extended_script.json \
  -o scripts/your-document/your-document.json
npx mulmo movie scripts/your-document/your-document.json
```

出力: `output/your-document_ja.mp4`

### 出力プロファイル

ExtendedMulmoScript には 2 つの出力プロファイルが含まれます：

- **`detailed`**: すべてのビートを含む完全版
- **`short`**: コアビートのみの要約版

preprocessor の `-p` オプションでプロファイルを切り替えられます：

```bash
# 要約版で生成
npx mulmocast-preprocessor scripts/your-document/extended_script.json \
  -o scripts/your-document/your-document.json -p short
```

### レビューと改善

動画を視聴してナレーションの品質を確認します。調整したい場合は：

1. `scripts/your-document/extended_script.json` の `text` フィールドを直接編集する
2. または `/md-to-mulmo` を再実行して調整を依頼する
3. 上記の動画生成コマンドを再実行する

## パイプラインの詳細（手動実行）

`/md-to-mulmo` の各ステップを個別に実行することもできます：

### Step 1: Markdown パース

```bash
mulmo-slide parse-md your-document.md
```

Markdown の構造（見出し、段落、コードブロック、リスト等）を解析し、JSON と JSON Schema を生成します。

### Step 2: プレゼンテーションプラン作成（LLM）

```bash
# Claude Code 内で実行:
/md-to-mulmo your-document.md
```

LLM が `parsed_structure.json` を基にプレゼンプラン（`presentation_plan.json`）を設計します。

### Step 3: ExtendedMulmoScript 組み立て

```bash
mulmo-slide assemble-extended scripts/your-document/presentation_plan.json
```

プレゼンプランから ExtendedMulmoScript を生成します。

### Step 4: MulmoScript 変換

```bash
npx mulmocast-preprocessor scripts/your-document/extended_script.json \
  -o scripts/your-document/your-document.json
```

### Step 5: 動画生成

```bash
npx mulmo movie scripts/your-document/your-document.json
```

出力: `output/your-document_ja.mp4`

## 代替ワークフロー: `/narrate`

既にスライド形式のプレゼンテーション（PDF、PPTX、Keynote）がある場合は、`/narrate` スキルも利用できます。詳しくは[PDF からナレーション付き動画を作成するチュートリアル](./tutorial-pdf-to-video-ja.md)をご覧ください。

## トラブルシューティング

### `mulmo-slide extend init` を実行していない

`/md-to-mulmo` スキルが見つからない場合は、`mulmo-slide extend init` を実行してスキルをインストールしてください。

### `parse-md` でファイルが見つからない

Markdown ファイルのパスが正しいか確認してください。相対パスまたは絶対パスのどちらでも指定できます。

### `assemble-extended` でバリデーションエラー

`presentation_plan.json` が `presentation-plan.schema.json` に準拠しているか確認してください。LLM が生成したプランのフォーマットが不正な場合は、`/md-to-mulmo` を再実行してください。

### `mulmo movie` で "Unrecognized key: scriptMeta" エラー

preprocessor がメタデータを完全に除去できない場合があります。以下で手動クリーンアップできます：

```bash
node -e "
const fs = require('fs');
const d = JSON.parse(fs.readFileSync('scripts/your-document/your-document.json', 'utf8'));
delete d.scriptMeta;
delete d.outputProfiles;
d.beats.forEach(b => { delete b.meta; delete b.variants; });
fs.writeFileSync('scripts/your-document/your-document.json', JSON.stringify(d, null, 2));
"
```

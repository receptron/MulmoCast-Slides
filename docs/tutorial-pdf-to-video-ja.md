# チュートリアル: PDF からナレーション付き動画を作成する

PDF（学術論文やスライド）を、AI が生成するナレーション付きの動画に変換する手順です。作成した ExtendedMulmoScript に対して、対話的に質問することもできます。

## 事前準備

- Node.js 20 以上
- ImageMagick（`magick` コマンド）
- [Claude Code](https://claude.com/claude-code)（`/narrate` ステップで使用）
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
mkdir my-narrate-project
cd my-narrate-project
```

### 2. API キーを設定

`.env` ファイルを作成して API キーを記述します：

```bash
cat <<'EOF' > .env
OPENAI_API_KEY=sk-your-openai-api-key
GEMINI_API_KEY=your-gemini-api-key
EOF
```

- `OPENAI_API_KEY`: 音声合成（TTS）と文字起こしに使用
- `GEMINI_API_KEY`: ナレーション生成に使用（`/narrate` スキル内で利用）

### 3. PDF ファイルを配置

変換したい PDF をプロジェクトディレクトリにコピーします：

```bash
cp /path/to/your-paper.pdf .
```

### 4. Claude Code スキルをインストール

```bash
mulmo-slide extend init
```

これで `.claude/skills/` にスキルファイルがコピーされます。

## クイックスタート（コピペで実行）

```bash
# Claude Code 内で実行:
/narrate your-paper.pdf
```

これだけです！ `/narrate` スキルが自動的に：
1. PDF をスライド画像に変換
2. 各ページからテキストを抽出
3. 各スライドの AI ナレーションを生成
4. メタデータ（キーワード、セクション、コンテキスト）を追加
5. スキーマ検証
6. 次のステップを表示

## `/narrate` が生成するもの

```
scripts/your-paper/
  your-paper.json        # MulmoScript（画像 + 空のテキスト）
  extracted_texts.json    # PDF から抽出した各ページのテキスト
  extended_script.json   # ExtendedMulmoScript（ナレーション + メタデータ）
  images/
    your-paper-0.png     # 1 ページ目の画像
    your-paper-1.png     # 2 ページ目の画像
    ...
```

## `/narrate` 後の次のステップ

### 内容に対話的に質問する

ドキュメントについて質問できます：

```bash
npx mulmocast-preprocessor query scripts/your-paper/extended_script.json -i
```

実行例：
```
> この論文の主題は何ですか？
LLM推論ハードウェアの課題について議論しています...

> 4つの研究方向とは？
1. High Bandwidth Flash (HBF)
2. Processing-Near-Memory (PNM)
3. 3D Compute-Logic Stacking
4. 低遅延インターコネクト

> exit
```

一つの質問だけ聞く：
```bash
npx mulmocast-preprocessor query scripts/your-paper/extended_script.json "HBFとは何ですか？"
```

要約を生成する：
```bash
npx mulmocast-preprocessor summarize scripts/your-paper/extended_script.json -l ja
```

### ナレーション付き動画を生成する

ExtendedMulmoScript をクリーンな MulmoScript に変換してから動画を生成します：

```bash
npx mulmocast-preprocessor scripts/your-paper/extended_script.json \
  -o scripts/your-paper/your-paper.json
npx mulmo movie scripts/your-paper/your-paper.json
```

出力: `output/your-paper_ja.mp4`

### レビューと改善

動画を視聴してナレーションの品質を確認します。調整したい場合は：

1. `scripts/your-paper/extended_script.json` の `text` フィールドを直接編集する
2. または `/narrate` を再実行して調整を依頼する
3. 上記の動画生成コマンドを再実行する

## 対応フォーマット

`/narrate` は MulmoCast-Slides がサポートするすべてのフォーマットで動作します：

```bash
/narrate your-paper.pdf       # 学術論文、ドキュメント
/narrate your-slides.pptx     # PowerPoint プレゼンテーション
/narrate your-slides.md       # Marp マークダウンスライド
/narrate your-slides.key      # Keynote（macOS のみ）
```

## トラブルシューティング

### `mulmo movie` で "Unrecognized key: scriptMeta" エラー

preprocessor がメタデータを完全に除去できない場合があります。以下で手動クリーンアップできます：

```bash
node -e "
const fs = require('fs');
const d = JSON.parse(fs.readFileSync('scripts/your-paper/your-paper.json', 'utf8'));
delete d.scriptMeta;
delete d.outputProfiles;
d.beats.forEach(b => { delete b.meta; delete b.variants; });
fs.writeFileSync('scripts/your-paper/your-paper.json', JSON.stringify(d, null, 2));
"
```

### 動画のナレーションが無音

`/narrate` を実行してからご確認ください。PDF コンバーターは意図的に `text` を空にしています。ナレーションは `/narrate` スキルが生成します。

### ImageMagick が見つからない

```bash
# macOS
brew install imagemagick

# Ubuntu/Debian
sudo apt-get install imagemagick
```

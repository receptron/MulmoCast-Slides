# Markdown Converter Documentation

`mulmo-slide markdown` コマンドの仕様と動作期待値のドキュメント。

## 概要

Markdown ファイルを MulmoScript 形式に変換する。セパレーターモードとプラグインにより柔軟な変換が可能。

## 基本コマンド

```bash
mulmo-slide markdown <file> [options]
```

## オプション

| オプション | 短縮 | 説明 | デフォルト |
|-----------|------|------|-----------|
| `--separator` | `-s` | スライド分割モード | `horizontal-rule` |
| `--mermaid` | - | Mermaidコードブロックをmermaid beatに変換 | `false` |
| `--directive` | - | Marpスタイルのディレクティブを削除 | `false` |
| `--style` | - | Markdownスライドのスタイル | なし |
| `--lang` | `-l` | 言語コード | 自動検出 |
| `--generate-text` | `-g` | LLMでナレーション生成 | `false` |

---

## セパレーターモード

### `horizontal-rule` (デフォルト)

`---` で分割。Marp/reveal.js 互換。

**入力:**
```markdown
# Slide 1
Content 1

---

# Slide 2
Content 2
```

**期待値:** 2 スライド

**YAML Front Matter の処理:**
```markdown
---
theme: default
---

# Slide 1
```
→ Front matter は削除され、1 スライドとして出力

---

### `heading`

すべての見出し (`#`, `##`, `###` など) で分割。

**入力:**
```markdown
# Title
Intro

## Section 1
Content 1

### Subsection
Sub content

## Section 2
Content 2
```

**期待値:** 4 スライド
1. `# Title` + Intro
2. `## Section 1` + Content 1
3. `### Subsection` + Sub content
4. `## Section 2` + Content 2

---

### `heading-1`

`#` (H1) のみで分割。

**入力:**
```markdown
# Chapter 1
## Section 1.1
Content

# Chapter 2
## Section 2.1
Content
```

**期待値:** 2 スライド
1. `# Chapter 1` + `## Section 1.1` + Content
2. `# Chapter 2` + `## Section 2.1` + Content

---

### `heading-2`

`##` (H2) のみで分割。

**入力:**
```markdown
# Main Title

## Section 1
Content 1

### Subsection
Sub content

## Section 2
Content 2
```

**期待値:** 3 スライド
1. `# Main Title` (H2 より前の内容)
2. `## Section 1` + Content 1 + `### Subsection` + Sub content
3. `## Section 2` + Content 2

---

### `heading-3`

`###` (H3) のみで分割。

---

### `blank-lines`

3行以上の空行で分割。

**入力:**
```markdown
Paragraph 1



Paragraph 2

Paragraph 3 (1 blank line - not separated)
```

**期待値:** 2 スライド
1. `Paragraph 1`
2. `Paragraph 2` + `Paragraph 3`

**注意:** 3つの改行 = 2つの空行 = 分割される

---

### `comment`

`<!-- slide -->` で分割。

**入力:**
```markdown
# Slide 1
Content 1

<!-- slide -->

# Slide 2
Content 2
```

**期待値:** 2 スライド

**大文字小文字:** 区別しない (`<!-- SLIDE -->` も有効)

---

### `page-break`

`<!-- pagebreak -->` または フォームフィード文字 (`\f`) で分割。

---

### カスタムパターン

正規表現で分割。

```bash
mulmo-slide markdown file.md -s '{"pattern": "===BREAK==="}'
```

---

## プラグイン

### `--mermaid`

````markdown` mermaid ブロックを MulmoScript の `mermaid` beat type に変換。

**入力:**
```markdown
# Diagram

```mermaid
flowchart TD
    A --> B
```

This is a diagram.
```

**期待値 (beat):**
```json
{
  "text": "This is a diagram.",
  "image": {
    "type": "mermaid",
    "title": "Diagram",
    "code": {
      "kind": "text",
      "text": "flowchart TD\n    A --> B"
    }
  }
}
```

**処理:**
1. `# ` 見出しからタイトルを抽出 (なければ `"Diagram"`)
2. mermaid ブロック以外のテキストを `text` に
3. mermaid ブロックを `code.text` に

**mermaid がないスライド:** 通常の markdown beat として出力

---

### `--directive`

Marp スタイルのディレクティブを削除。

**入力:**
```markdown
<!-- _class: lead -->
<!-- _backgroundColor: #fff -->

# Title

Content
```

**期待値:**
```markdown
# Title

Content
```

**対応ディレクティブ:**
- `<!-- _class: ... -->`
- `<!-- _backgroundColor: ... -->`
- `<!-- _backgroundImage: ... -->`
- `<!-- _header: ... -->`
- `<!-- _footer: ... -->`
- `<!-- _paginate: ... -->`

---

## スタイル

`--style` オプションで markdown スライドにスタイルを適用。

```bash
mulmo-slide markdown file.md --style corporate-blue
```

**期待値 (beat):**
```json
{
  "text": "...",
  "image": {
    "type": "markdown",
    "markdown": ["# Title", "Content"],
    "style": "corporate-blue"
  }
}
```

**利用可能なスタイル例:**
- `corporate-blue`, `finance-green`, `startup-orange`
- `cyber-neon`, `matrix-green`
- `sakura-pink`, `zen-garden`

完全なリストは `mulmo tool info styles` で確認。

---

## Speaker Notes

HTML コメントをスピーカーノートとして抽出。
[Marp/Marpit の仕様](https://github.com/marp-team/marpit/blob/main/docs/usage.md) に準拠。

**入力:**
```markdown
# Slide

Content

<!-- This is a speaker note -->
```

**期待値:**
```json
{
  "text": "This is a speaker note",
  "image": {
    "type": "markdown",
    "markdown": ["# Slide", "Content"]
  }
}
```

**複数コメント:** 改行で結合

### 除外されるコメント

以下のプレフィックスで始まるコメントはコード用コメントとみなし、スピーカーノートから除外:

| パターン | 例 |
|---------|-----|
| `TODO:` | `<!-- TODO: fix this -->` |
| `FIXME:` | `<!-- FIXME: broken -->` |
| `HACK:` | `<!-- HACK: workaround -->` |
| `XXX:` | `<!-- XXX: needs review -->` |
| `NOTE:` | `<!-- NOTE: implementation detail -->` |
| `BUG:` | `<!-- BUG: known issue -->` |
| `WARNING:` / `WARN:` | `<!-- WARNING: do not modify -->` |
| `DEPRECATED:` | `<!-- DEPRECATED: use new API -->` |
| `REVIEW:` | `<!-- REVIEW: needs approval -->` |

**重要:** コロン (`:`) が必須。`<!-- Note 1 -->` や `<!-- TODO fix -->` は除外されない。

**大文字小文字:** 区別しない（`todo:`, `Todo:`, `TODO:` すべて除外）

**入力:**
```markdown
# Slide

<!-- TODO: fix this later -->
<!-- This is the actual speaker note -->
```

**期待値:** `"text": "This is the actual speaker note"` (TODO は除外)

---

## 出力

```
scripts/<basename>/
└── <basename>.json
```

**MulmoScript 構造:**
```json
{
  "$mulmocast": {
    "version": "1.1",
    "credit": "closing"
  },
  "lang": "ja",
  "beats": [
    {
      "text": "スピーカーノート",
      "image": {
        "type": "markdown",
        "markdown": ["# タイトル", "内容"],
        "style": "corporate-blue"
      }
    }
  ]
}
```

---

## エッジケース

### 空のスライド

セパレーター間に内容がない場合、スキップされる。

```markdown
# Slide 1

---

---

# Slide 2
```
→ 2 スライド (空スライドは除外)

### CRLF (Windows 改行)

自動的に LF に正規化。

### コードブロック内のセパレーター

**注意:** 現在の実装では、コードブロック内の `---` も分割対象。

```markdown
# Code Example

```markdown
---
This is in a code block
---
```
```

→ 意図しない分割が発生する可能性あり

---

## テストコマンド

```bash
cd ~/ss/llm/MulmoCast-Slides

# horizontal-rule (8 slides expected)
yarn cli markdown samples/markdown_separators.md
cat scripts/markdown_separators/markdown_separators.json | jq '.beats | length'

# heading-1 (5 slides expected)
yarn cli markdown samples/heading_separator.md -s heading-1
cat scripts/heading_separator/heading_separator.json | jq '.beats | length'

# heading-2 (9 slides expected)
yarn cli markdown samples/heading_separator.md -s heading-2
cat scripts/heading_separator/heading_separator.json | jq '.beats | length'

# mermaid option (beat type = "mermaid")
yarn cli markdown samples/markdown_separators.md --mermaid
cat scripts/markdown_separators/markdown_separators.json | jq '.beats[3].image.type'

# directive option (no _class in output)
yarn cli markdown samples/markdown_separators.md --directive
cat scripts/markdown_separators/markdown_separators.json | jq '.beats[4].image.markdown | join("")' | grep -c "_class"

# both plugins
yarn cli markdown samples/markdown_separators.md --mermaid --directive

# style option
yarn cli markdown samples/markdown_separators.md --style finance-green
cat scripts/markdown_separators/markdown_separators.json | jq '.beats[0].image.style'
```

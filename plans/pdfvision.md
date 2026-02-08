# Plan: pdfvision - Vision API-based intelligent PDF to presentation conversion

Issue: #74

## Goal

PDFを1ページ=1スライドの機械的変換ではなく、Vision APIで文書全体を分析し、論理セクション単位で構成された解説プレゼンを生成する。

## Design

### CLI

```bash
mulmo-slide pdfvision paper.pdf -l ja                    # デフォルトプロバイダー
mulmo-slide pdfvision paper.pdf --provider gemini        # Gemini Flash（安い）
mulmo-slide pdfvision paper.pdf --provider openai        # GPT-4o
```

### Pipeline

```
Step 1: 既存処理（無料）
  PDF → ImageMagick → ページ画像
  PDF → pdf-parse → extracted_texts.json

Step 2: Vision API 1回（コストここだけ）
  全ページ画像（低解像度） + 抽出テキスト → LLM Vision
  → 出力: DocumentAnalysis JSON
    - sections: 論理セクション構成
    - figures: 図表の特定（ページ番号、タイプ、説明）
    - slides: プレゼン構成案（どのセクション/図をどのスライドに）

Step 3: 画像処理（ローカル、無料）
  DocumentAnalysis に基づき:
  - 重要な図表がある場合: ページ画像を使用（or クロップ）
  - テキスト中心のスライド: ページ画像をそのまま使用
  → 選択/加工された画像ファイル

Step 4: ナレーション生成（テキストonly LLM、安い）
  抽出テキスト + Step 2の構造分析 → テキストonly LLMでナレーション生成
  → MulmoScript beats with text

Step 5: MulmoScript 出力
  → scripts/{basename}/{basename}.json
  → scripts/{basename}/extracted_texts.json
```

### Provider 設計

ネイティブSDKを使用（互換エンドポイントではなく）。

```
Gemini: @google/generative-ai パッケージ
OpenAI: openai パッケージ（既存）
```

自動判定:
1. `--provider` フラグがあれば → それを使う
2. `GEMINI_API_KEY` があれば → Gemini 2.0 Flash
3. `OPENAI_API_KEY` があれば → GPT-4o
4. どちらもなければ → エラー

## Implementation Plan

### Step 1: `src/utils/vision-provider.ts` (新規)

Vision APIプロバイダーの抽象層。

```typescript
export type VisionProvider = "gemini" | "openai";

export interface VisionRequest {
  prompt: string;
  images: Array<{ base64: string; mimeType: string }>;
}

export interface VisionResponse {
  content: string;
}

// プロバイダー解決（CLI引数 > 環境変数 > エラー）
export const resolveVisionProvider = (preferred?: string): VisionProvider

// Vision API呼び出し（プロバイダー非依存）
export const callVisionAPI = async (
  provider: VisionProvider,
  request: VisionRequest
): Promise<VisionResponse>

// テキストonly LLM呼び出し（ナレーション生成用、安い）
export const callTextLLM = async (
  provider: VisionProvider,
  prompt: string
): Promise<string>
```

内部実装:
- `callGeminiVision()`: `@google/generative-ai` ネイティブSDK
- `callOpenAIVision()`: 既存 `openai` パッケージ
- `callGeminiText()` / `callOpenAIText()`: テキストonly版

### Step 2: `src/utils/document-analysis.ts` (新規)

Vision APIに渡すプロンプトと、レスポンスの型定義・パース。

```typescript
export interface DocumentAnalysis {
  title: string;
  authors?: string;
  sections: Array<{
    name: string;           // セクション名
    pages: number[];        // 該当ページ番号（0-based）
    summary: string;        // セクション概要
  }>;
  figures: Array<{
    page: number;           // ページ番号（0-based）
    type: "figure" | "table" | "chart" | "diagram";
    label?: string;         // "Figure 1", "Table 2" 等
    description: string;    // 図表の内容説明
    importance: "high" | "medium" | "low";
  }>;
  slides: Array<{
    title: string;          // スライドタイトル
    section: string;        // 所属セクション
    sourcePages: number[];  // ソースページ（0-based）
    imagePage?: number;     // メイン画像として使うページ
    figureRef?: string;     // 参照する図表の label
    narrationHint: string;  // ナレーションのヒント
  }>;
}

// プロンプト構築（純粋関数、テスト可能）
export const buildDocumentAnalysisPrompt = (options: {
  pageCount: number;
  extractedTexts: string[];
  lang: SupportedLang;
}): string

// レスポンスパース（純粋関数、テスト可能）
export const parseDocumentAnalysis = (content: string): DocumentAnalysis
```

### Step 3: `src/utils/narration-generator.ts` (新規)

テキストonly LLMでナレーション生成。

```typescript
export interface NarrationInput {
  slides: DocumentAnalysis["slides"];
  extractedTexts: string[];
  documentAnalysis: DocumentAnalysis;
  lang: SupportedLang;
}

// プロンプト構築（純粋関数、テスト可能）
export const buildNarrationPrompt = (input: NarrationInput): string

// レスポンスパース（純粋関数、テスト可能）
export const parseNarrationResponse = (
  content: string,
  slideCount: number
): Array<{ index: number; text: string }>
```

### Step 4: `src/convert/pdfvision.ts` (新規)

メインパイプライン。

```typescript
export interface ConvertPdfVisionOptions {
  inputPath: string;
  lang?: SupportedLang;
  provider?: string;  // "gemini" | "openai"
}

export interface ConvertPdfVisionResult {
  mulmoScriptPath: string;
  extractedTextsPath: string | null;
  slideCount: number;
  analysisPath: string;  // DocumentAnalysis JSON保存先
}

export const convertPdfVision = async (
  options: ConvertPdfVisionOptions
): Promise<ConvertPdfVisionResult>
```

パイプライン:
1. 既存 `convertPdfToImages()` でページ画像化
2. 既存 `extractTextFromPdf()` でテキスト抽出
3. 画像を低解像度にリサイズ（ImageMagick `mogrify` or sharp）
4. `callVisionAPI()` で DocumentAnalysis 取得
5. DocumentAnalysis を `scripts/{basename}/analysis.json` に保存
6. `callTextLLM()` でナレーション生成
7. MulmoScript 組み立て
   - beats = DocumentAnalysis.slides ベース
   - 各beatの画像 = slides[].imagePage のページ画像
8. `scripts/{basename}/{basename}.json` に書き出し

### Step 5: `src/cli.ts` に `pdfvision` コマンド追加

```typescript
.command(
  "pdfvision <file>",
  "Convert PDF to MulmoScript using Vision API analysis",
  (yargs) => {
    return yargs
      .positional("file", { describe: "PDF file", type: "string", demandOption: true })
      .options({
        ...langOption,
        provider: {
          type: "string",
          description: "Vision API provider (gemini or openai)",
          choices: ["gemini", "openai"],
        },
      });
  },
  async (argv) => {
    const { convertPdfVision } = await import("./convert/pdfvision.js");
    await convertPdfVision({
      inputPath: argv.file,
      lang: argv.l as SupportedLang | undefined,
      provider: argv.provider as string | undefined,
    });
  }
)
```

### Step 6: 依存パッケージ追加

```bash
yarn add @google/generative-ai
```

### Step 7: テスト

**`tests/test_document_analysis.ts`** (新規):
- `buildDocumentAnalysisPrompt` のプロンプト構築テスト
- `parseDocumentAnalysis` のレスポンスパーステスト
- 不正JSONのエラーハンドリング

**`tests/test_narration_generator.ts`** (新規):
- `buildNarrationPrompt` のプロンプト構築テスト
- `parseNarrationResponse` のレスポンスパーステスト

**`tests/test_vision_provider.ts`** (新規):
- `resolveVisionProvider` のプロバイダー解決テスト
- 環境変数ベースの自動判定テスト

LLM API は呼ばない（純粋関数のみテスト）。

### Step 8: ドキュメント更新

- `AGENTS.md`: pdfvision コマンド追加
- `CLAUDE.md`: pdfvision の使い方追加
- `README.md`: pdfvision セクション追加
- `package.json`: `"pdfvision": "tsx src/cli.ts pdfvision"` スクリプト追加

## File Changes

| ファイル | 変更 |
|---------|------|
| `src/utils/vision-provider.ts` | **新規**: Vision APIプロバイダー抽象層 |
| `src/utils/document-analysis.ts` | **新規**: 文書分析プロンプト・パーサー |
| `src/utils/narration-generator.ts` | **新規**: ナレーション生成プロンプト・パーサー |
| `src/convert/pdfvision.ts` | **新規**: メインパイプライン |
| `src/cli.ts` | `pdfvision` コマンド追加 |
| `package.json` | `@google/generative-ai` 追加、pdfvision スクリプト |
| `tests/test_document_analysis.ts` | **新規**: 分析プロンプト/パーサーテスト |
| `tests/test_narration_generator.ts` | **新規**: ナレーション生成テスト |
| `tests/test_vision_provider.ts` | **新規**: プロバイダー解決テスト |
| `AGENTS.md` | コマンドドキュメント追加 |
| `CLAUDE.md` | pdfvision 使い方追加 |
| `README.md` | pdfvision セクション追加 |

## Cost Estimate (18-page academic paper)

| Step | API | Model | Cost |
|------|-----|-------|------|
| 文書分析 (Vision) | Gemini | 2.0 Flash | ~$0.01 |
| ナレーション生成 (Text) | Gemini | 2.0 Flash | ~$0.005 |
| **合計** | | | **~$0.015** |

OpenAI使用時: 文書分析 ~$0.05-0.50, ナレーション ~$0.02 → 合計 ~$0.07-0.52

## Verification

```bash
# ビルド・テスト
yarn build && yarn test && yarn lint

# pdfvision テスト (Gemini)
GEMINI_API_KEY=xxx yarn cli pdfvision 2601.05047v2.pdf -l ja

# pdfvision テスト (OpenAI)
OPENAI_API_KEY=xxx yarn cli pdfvision 2601.05047v2.pdf -l ja --provider openai

# 出力確認
cat scripts/2601.05047v2/analysis.json    # DocumentAnalysis
cat scripts/2601.05047v2/2601.05047v2.json  # MulmoScript
```

## Open Questions

1. **画像リサイズ**: Vision APIに渡す画像の解像度。Geminiは自動リサイズするので不要かも。OpenAIは `detail: "low"` で十分か
2. **クロップ**: 図表の切り出しは初期バージョンでは見送り、ページ画像をそのまま使う。将来的にはVisionが返す座標情報でクロップ
3. **大規模PDF**: 50ページ超の場合の分割戦略。Geminiは大量画像を受け付けるが、OpenAIには制限あり
4. **既存パイプラインとの統合**: `narrate` コマンドに `--vision` オプションとして統合するか、独立コマンドのままか

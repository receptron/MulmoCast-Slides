# Layout Auto-Detection Test

---

## コードブロック + テキスト

GraphAIは宣言的なワークフローエンジンです。

主な特徴:
- 並列処理の自動化
- LLMとの統合
- 拡張可能なエージェントシステム

```typescript
const graph = new GraphAI({
  nodes: {
    input: { value: "Hello" },
    output: { agent: "echoAgent" }
  }
});
await graph.run();
```

---

## 画像 + テキスト

MulmoCastで作成したプレゼンテーションの例です。

このスライドでは画像と説明文を組み合わせています。

![Sample Image](https://example.com/image.png)

---

### Q1 業績
売上: 100万円
前年比: +10%

### Q2 業績
売上: 120万円
前年比: +15%

### Q3 業績
売上: 150万円
前年比: +20%

### Q4 業績
売上: 180万円
前年比: +25%

---

## 左側セクション

ここには左側のコンテンツが表示されます。

- ポイント1
- ポイント2

## 右側セクション

ここには右側のコンテンツが表示されます。

- 詳細A
- 詳細B

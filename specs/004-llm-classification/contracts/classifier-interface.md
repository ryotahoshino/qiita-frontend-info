# Contract: Classifier インターフェース

`src/core/classifier.ts`

```ts
export interface Classifier {
  name: string;
  classify(
    items: NewsItem[],
    topics: Topic[],
    topicsMarkdown: string,
  ): Promise<Classification[]>;
}
```

## 事前条件

- `items` は0件以上の `NewsItem` 配列(呼び出し元の `src/digest.ts` は既に0件チェック済みで
  呼ぶため、実装側で0件を特別扱いする必要はない)
- `topics` は `parseTopics()` 済みの配列(空配列を渡された場合の挙動は実装依存でよいが、
  `KeywordClassifier` は空配列なら全件 `skip` を返す既存挙動を維持する)

## 事後条件

- 戻り値の配列は `items` と同じ長さ・同じ順序
- 例外を投げない(内部で発生したエラーは `Classifier` の実装内で処理し、必ず妥当な
  `Classification[]` を返す)

## 実装一覧

| 実装 | ファイル | 概要 |
|---|---|---|
| `KeywordClassifier` | `src/core/topicMatcher.ts`(既存 `classify` をラップ) | `topicsMarkdown` は無視し、各 `item` に既存の `classify(item, topics)` を適用する |
| `AnthropicClassifier` | `src/core/anthropicClassifier.ts`(新規) | Anthropic Messages APIを呼び出す。失敗時は `fallback` に委譲する(下記 [anthropic-classify-contract.md](anthropic-classify-contract.md) 参照) |

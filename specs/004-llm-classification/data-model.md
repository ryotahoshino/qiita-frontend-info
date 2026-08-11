# データモデル: LLMありモード(オプトイン分類)

既存の型(`NewsItem`、`Topic`、`Classification`)は spec 001/003 で定義済みのものを再利用する。
本specで新規に追加する型・インターフェースのみ記載する。

## Classifier(新規インターフェース)

`src/core/classifier.ts` に定義する。`KeywordClassifier`(既存 `classify` のラップ)と
`AnthropicClassifier` の両方がこれを実装する。

| フィールド | 型 | 説明 |
|---|---|---|
| `name` | `string` | 実装名(ログ・デバッグ用。例: `"keyword"`, `"anthropic"`) |
| `classify` | `(items: NewsItem[], topics: Topic[], topicsMarkdown: string) => Promise<Classification[]>` | 記事一覧を分類する。戻り値の配列は `items` と同じ順序・同じ長さで対応する(`classifications[i]` が `items[i]` の分類結果) |

**不変条件**: `classify()` は例外を投げない(投げた場合の扱いは呼び出し元
`AnthropicClassifier` 内部で吸収し、外部には常に妥当な `Classification[]` を返す。
`KeywordClassifier` はそもそも同期的なキーワード一致のみなので例外は発生しない)。

## AnthropicClassifierOptions(新規)

`createAnthropicClassifier(options: AnthropicClassifierOptions): Classifier` の引数。

| フィールド | 型 | 説明 |
|---|---|---|
| `apiKey` | `string` | `ANTHROPIC_API_KEY` の値。空文字は許容しない(呼び出し側で存在確認済みの前提) |
| `fallback` | `Classifier` | API失敗・パース失敗・スキーマ不一致時に分類を委譲する先(`KeywordClassifier`を渡す想定) |
| `logError` | `(entry: ErrorLogEntry) => Promise<void>` | フォールバック発生時に呼ぶ。`src/digest.ts` の `deps.logError` をそのまま渡す想定 |

## ErrorLogEntry(既存型の拡張)

`src/core/errorLog.ts` の `ErrorLogEntry.errorType` に新しい値を追加する(型自体は
`string` のままなので破壊的変更ではないが、規約として値を定義する)。

| errorType | phase | 発生条件 |
|---|---|---|
| `llm_classification_failed` | `"collect"`(既存の分類関連フローに合わせる) | Anthropic API呼び出し失敗 / JSONパース失敗 / スキーマ不一致のいずれか。`message` にどのケースかを含める |

## DigestDeps(既存インターフェースの変更)

`src/digest.ts` の `DigestDeps` を以下のように変更する。

| フィールド | 変更前 | 変更後 |
|---|---|---|
| 分類ロジック | `src/core/topicMatcher.ts` の `classify` を直接import | `classifier: Classifier` を新規追加(注入される依存) |
| `topicsMarkdown` | (無し) | `topicsMarkdown: string` を新規追加(`Classifier.classify` の第3引数として渡すため) |

`topics: Topic[]`(spec 003で追加済み)は維持する。`main.ts` で `parseTopics(topicsMarkdown)`
した結果と、生の `topicsMarkdown` 文字列の両方を保持して `DigestDeps` に渡す。

## Anthropic Messages API リクエスト/レスポンス形状(参考)

`contracts/anthropic-classify-contract.md` に詳細を記載する。ここでは概要のみ:

- リクエスト: `system` に指示文+`TOPICS.md`全文、`messages[0].content` に記事データ
  (`<article id="N">` タグで区切り)、`tools` に `classify_articles` ツール定義
- レスポンス: `tool_use` ブロックの `input` に `{ classifications: { topic: string; relevance: string }[] }`
  相当のJSON(配列順は入力記事の順序と対応)

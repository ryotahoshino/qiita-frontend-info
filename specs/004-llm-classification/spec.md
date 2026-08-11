# 004: LLMありモード(オプトイン分類)

- status: draft(← Claude Codeと壁打ちして固め、承認したら approved に変更)

<!--
  このプロジェクト(qiita-frontend-digest)のspec.mdは、GitHub Spec Kit標準のUser Story形式ではなく
  specs/001〜003で確立した独自フォーマットを使う(.specify/memory/constitution.md 参照)。
-->

## 目的(なぜ作るか)

spec 003で実装したキーワードマッチ分類(`src/core/topicMatcher.ts` の `classify`)に加えて、
オプトインのLLM分類モードを追加する。`config.yaml` の `llm.enabled` が `true` かつ
APIキーが設定されている場合、`TOPICS.md` 全文(`##` 見出し・`keywords`・自由記述の `note`、
および `keywords:` 行を持たないため現状はキーワードマッチで無視される `## 除外条件` セクションを
含む)をLLMへのプロンプトに注入し、各記事のトピック判定(またはskip)をLLMに行わせる。

CLAUDE.mdの原則「LLM要約・LLM分類はオプトイン。APIキーなしでもキーワードマッチで全機能が
動くこと」に従い、LLMモードは無効時・キー未設定時に一切動作せず、既存のキーワードマッチのみで
全機能が継続することを保証する(DESIGN.mdロードマップ v0.2の一部)。

## 要件(何ができればよいか)

- 分類器を **`Classifier` インターフェース**として定義する(`src/core/classifier.ts` 等)。
  ```ts
  interface Classifier {
    name: string;
    classify(items: NewsItem[], topics: Topic[], topicsMarkdown: string): Promise<Classification[]>;
  }
  ```
  spec 003のキーワードマッチ(`classify` 関数)はこのインターフェースを実装する
  `KeywordClassifier` としてラップする。Anthropic実装(`AnthropicClassifier`)も同じ
  インターフェースを実装し、両者は `src/digest.ts` から見て区別されないプラグインとする
  (CLAUDE.mdのCollector/Publisherと同様、インターフェースを実装するプラグインとして追加する
  原則に倣う)
- `src/digest.ts` の `DigestDeps` は分類関数を直接importせず、**`classifier: Classifier` を
  注入される依存として受け取る**。どの実装(Keyword/Anthropic)が使われるかをdigest.ts側は
  意識しない。これにより、digest.tsの受け入れ条件はモックの `Classifier` で検証でき、
  Anthropicへの実際のAPI呼び出しを伴う検証と分離できる
- Anthropic実装は `src/core/anthropicClassifier.ts`(仮)に外部I/Oを閉じ込め、
  `createAnthropicClassifier(options: { apiKey: string; fallback: Classifier; logError: (entry) => Promise<void> }): Classifier`
  の形で提供する。APIキーは環境変数 `ANTHROPIC_API_KEY` からのみ取得する(コード・config・
  テストへの直書き禁止)
- プロンプトには `TOPICS.md` の全文(`## 除外条件` セクションを含む)を注入するが、
  **記事由来のテキスト(タイトル・summary、フィード提供元からの外部入力)は指示文と明確に分離し、
  データとして扱う**(例: Anthropic Messages APIの `system` パラメータに指示文を置き、
  記事データは `user` メッセージ内で明確なタグ/区切り文字で囲んで渡す)。フィード由来のテキストを
  そのまま指示として解釈させない(プロンプトインジェクション対策)
- `config.yaml` の `llm.enabled: true` かつ `ANTHROPIC_API_KEY` が設定されている場合のみ
  `AnthropicClassifier`(内部に `KeywordClassifier` をfallbackとして持つ)を注入する。
  いずれかが欠けている場合は `KeywordClassifier` を直接注入する(エラーにはしない)。
  この選択は `main.ts`(配線層)の責務とする
- `AnthropicClassifier` は以下のいずれかが発生した場合、そのバッチを `fallback`
  (`KeywordClassifier`)による分類結果に切り替え、`logs/errors/YYYY-MM-DD.json` に
  **`errorType: "llm_classification_failed"`** として記録する(通常のエラーと区別し、
  フォールバックが発生したことがログから判別できるようにする。digest全体の実行は止めない):
  - LLM API呼び出し自体の失敗(タイムアウト・レート制限・ネットワークエラー等)
  - LLMの応答がJSONとしてパースできない
  - LLMの応答が期待するスキーマ(`{ topic: string; relevance: "high" | "medium" | "skip" }[]`)
    と一致しない
- 上記のフォールバックとは別に、LLMの応答がスキーマとしては妥当だが `topic` が `topics` に
  存在しない場合は、記事単位で `relevance: "skip"` として扱う(バッチ全体をfallbackさせない)

### 前提とした判断(壁打ちで要確認)

- LLMプロバイダはAnthropic Claude APIを既定とした(他プロバイダ対応はスコープ外)
- LLMモードは「キーワードマッチの結果に足す」のではなく「有効時はLLMが分類全体を担う」設計とした
  (DESIGN.mdの「noteの自然言語ニュアンスも含めて関連度を判定」という記述に基づく)。
  ただし `AnthropicClassifier` は内部に `KeywordClassifier` をfallbackとして保持する設計に
  変更し、失敗時のみキーワードマッチへ切り替わる
- LLM API失敗時はエラーを記録した上でキーワードマッチにフォールバックする設計とした
  (spec 001/003の「1件の失敗で全体を止めない」原則を踏襲)。フォールバックの発生は
  `errorType: "llm_classification_failed"` としてログから判別可能にする

## 受け入れ条件

検証方法の方針: `AnthropicClassifier` は実際のAnthropic APIをモックして検証する
(`[vitest]`)。実際のAPIキーを使った疎通確認のみ `[手動]` とする。`src/digest.ts` 側は
モックの `Classifier` を注入して検証し、Keyword/Anthropicどちらの実装かを意識しない。

### Classifierインターフェース・digest.ts側(実装非依存)

- `[vitest]` Given: `DigestDeps` にモックの `Classifier`(任意の分類結果を返す)を注入する
  / When: `digest` を実行する
  Then: `digest.ts` は注入された `Classifier` の分類結果をそのまま使って `articles/` 生成・
        `state.json` 記録・`logs/skipped/` 記録を行う(spec 003のパイプライン統合と同じ規約)。
        `Classifier` の実装がKeywordかAnthropicかによって `digest.ts` の挙動は変わらない

- `[vitest]` Given: `llm.enabled` が `false`(デフォルト)、または `ANTHROPIC_API_KEY` が未設定
  / When: `main.ts` の配線ロジックで使用する `Classifier` を決定する
  Then: `KeywordClassifier` が選ばれ、Anthropic向けの依存(APIキー等)は一切参照されない
        (spec 003 AC12と同じ不変条件の再確認)

### AnthropicClassifier(モックしたAnthropic呼び出しで検証)

- `[vitest]` Given: モックしたAnthropic APIが妥当なJSON応答を返す / When: `classify` を呼ぶ
  Then: 送信されるプロンプトの `system` には指示文のみが含まれ、記事のタイトル・summaryは
        `user` メッセージ内で指示文とは明確に区切られたデータとして渡される(指示文と記事本文が
        混在しない)

- `[vitest]` Given: モックしたAnthropic APIがエラーを返す(タイムアウト・レート制限・
  ネットワークエラー等) / When: `classify` を呼ぶ
  Then: `fallback`(`KeywordClassifier`)による分類結果が返り、`logError` が
        `errorType: "llm_classification_failed"` で1回呼ばれる

- `[vitest]` Given: モックしたAnthropic APIの応答がJSONとしてパースできない / When: `classify` を呼ぶ
  Then: 同様に `fallback` の結果が返り、`errorType: "llm_classification_failed"` として記録される

- `[vitest]` Given: モックしたAnthropic APIの応答はJSONとして妥当だが期待するスキーマと異なる
  (例: `topic`/`relevance` フィールドが欠落) / When: `classify` を呼ぶ
  Then: 同様に `fallback` の結果が返り、`errorType: "llm_classification_failed"` として記録される

- `[vitest]` Given: モックしたAnthropic APIの応答はスキーマとして妥当だが、`topics` に存在しない
  `topic` 名を含む記事が1件ある / When: `classify` を呼ぶ
  Then: `fallback` へは切り替わらず、当該記事のみ `relevance: "skip"` として扱われ、他の記事は
        Anthropicの分類結果がそのまま使われる

### 実API疎通確認(手動)

- `[手動]` Given: 実際の `ANTHROPIC_API_KEY` と `config.yaml` の `llm.enabled: true` を設定した
  環境 / When: `digest` を実行する
  Then: 実際のAnthropic APIへリクエストが送られ、エラーなく分類結果が得られて `articles/` に
        反映される(モックでは検証できない実際のAPI仕様・認証・レスポンス形式の疎通確認)

  > **未検証(2026-08-12時点)**: 実API疎通はコスト都合で保留している。モックしたfetchによる
  > `[vitest]` 受け入れ条件(プロンプト分離・API失敗時フォールバック・パース失敗・スキーマ不一致・
  > 未知トピック名の各ケース)はすべて実装・検証済みだが、実際のAnthropic APIとの疎通(認証・
  > レスポンス形式が想定通りであること)は未確認。実施する際は `quickstart.md` の手順に従うこと。

## スコープ外(今回やらないこと)

- LLMによる記事要約の生成(一言コメント等)。本specは分類のみを対象とする
- Anthropic以外のLLMプロバイダ対応
- LLM呼び出しのリトライ・高度なレート制御・コスト管理
- v0.3: `logs/skipped/` のLLM分析による `TOPICS.md` 自動追記PR化(別spec)
- `.github/workflows/daily.yml` の変更。LLMモードをGitHub Actions上で有効化する際は
  `ANTHROPIC_API_KEY` をdigestステップの環境変数として渡すよう `daily.yml` の更新が必要だが、
  本specでは対応しない(別spec)

## 関連

- docs/DESIGN.md「Filter / Classifier(TOPICS.md 駆動)」「LLMありモード」
- specs/003-topics-filter/spec.md(`classify`/`parseTopics`/`DigestDeps`分類ステップの前提)
- CLAUDE.md「LLM要約・LLM分類はオプトイン。APIキーなしでもキーワードマッチで全機能が動くこと」
- `.specify/memory/constitution.md`「III. LLMはオプトイン」

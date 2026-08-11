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

- LLM呼び出しを行うI/Oを `src/core/llmClassifier.ts` に分離し、
  `classifyWithLlm(items: NewsItem[], topicsMarkdown: string, apiKey: string): Promise<Classification[]>`
  を実装する(外部I/Oをこの関数に閉じ込め、コアロジックとは分離する)
- プロンプトには `TOPICS.md` の全文(`## 除外条件` セクションを含む)をそのまま注入する
- LLM APIは Anthropic Claude API を使用し、APIキーは環境変数 `ANTHROPIC_API_KEY` からのみ
  取得する(コード・config・テストへの直書き禁止)
- `config.yaml` の `llm.enabled: true` かつ `ANTHROPIC_API_KEY` が設定されている場合のみ
  LLMモードを使用する。いずれかが欠けている場合は既存のキーワードマッチにフォールバックする
  (エラーにはしない)
- LLM API呼び出しが失敗(タイムアウト・レート制限・不正レスポンス等)した場合、そのバッチは
  キーワードマッチによる分類にフォールバックし、`logs/errors/YYYY-MM-DD.json` にエラーとして
  記録する。digest全体の実行は止めない
- `src/digest.ts` の分類ステップ(`classifyItems`)を、キーワード分類とLLM分類のどちらでも
  差し替えられる形にする(`DigestDeps` に分類関数を注入するか、モード判定込みの関数を渡す)
- LLMの応答は各記事ごとに `{ topic: string; relevance: "high" | "medium" | "skip" }` の形に
  パースする。`topics` に存在しないトピック名をLLMが返した場合はskip扱いにする(不正な応答への
  耐性)

### 前提とした判断(壁打ちで要確認)

- LLMプロバイダはAnthropic Claude APIを既定とした(他プロバイダ対応はスコープ外)
- LLMモードは「キーワードマッチの結果に足す」のではなく「有効時はLLMが分類全体を担う」設計とした
  (DESIGN.mdの「noteの自然言語ニュアンスも含めて関連度を判定」という記述に基づく)
- LLM API失敗時はエラーを記録した上でキーワードマッチにフォールバックする設計とした
  (spec 001/003の「1件の失敗で全体を止めない」原則を踏襲)

## 受け入れ条件

- `[vitest]` Given: `llm.enabled` が `false`(デフォルト) / When: `digest` を実行する
  Then: LLM API呼び出しは一切発生せず、既存のキーワードマッチのみで分類される
        (spec 003 AC12と同じ不変条件の再確認)

- `[vitest]` Given: `llm.enabled` が `true` だが `ANTHROPIC_API_KEY` が未設定
  / When: `digest` を実行する
  Then: エラーにはならず、キーワードマッチにフォールバックして分類が完了する

- `[vitest]` Given: `llm.enabled` が `true` かつ `ANTHROPIC_API_KEY` が設定済み
  / When: `classifyWithLlm` を呼び出す
  Then: LLMへ送るプロンプトに `TOPICS.md` の全文(`## 除外条件` セクションを含む)が
        含まれている

- `[vitest]` Given: LLM API呼び出しがエラーを返す(タイムアウト・レート制限・不正レスポンス等)
  / When: `digest` を実行する
  Then: エラーが `logs/errors/YYYY-MM-DD.json` に記録され、キーワードマッチにフォールバックし、
        exit code 0 で終了する

- `[vitest]` Given: LLMが `topics` に存在しないトピック名を返す / When: 分類結果をパースする
  Then: 当該記事は `skip` 扱いになる

- `[vitest]` Given: LLMが記事ごとに妥当な `topic`/`relevance` を返す
  / When: `digest` を実行し `articles/` を生成する
  Then: spec 003と同様に `topics` 宣言順にセクション分けされ、`state.json`・`logs/skipped/`への
        記録もキーワードモードと同じ規約に従う

## スコープ外(今回やらないこと)

- LLMによる記事要約の生成(一言コメント等)。本specは分類のみを対象とする
- Anthropic以外のLLMプロバイダ対応
- LLM呼び出しのリトライ・高度なレート制御・コスト管理
- v0.3: `logs/skipped/` のLLM分析による `TOPICS.md` 自動追記PR化(別spec)

## 関連

- docs/DESIGN.md「Filter / Classifier(TOPICS.md 駆動)」「LLMありモード」
- specs/003-topics-filter/spec.md(`classify`/`parseTopics`/`DigestDeps`分類ステップの前提)
- CLAUDE.md「LLM要約・LLM分類はオプトイン。APIキーなしでもキーワードマッチで全機能が動くこと」
- `.specify/memory/constitution.md`「III. LLMはオプトイン」

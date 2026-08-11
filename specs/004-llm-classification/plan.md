# Implementation Plan: LLMありモード(オプトイン分類)

**Branch**: `004-llm-classification` | **Date**: 2026-07-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-llm-classification/spec.md`

## Summary

spec 003で実装したキーワードマッチ分類を `KeywordClassifier` としてラップし、新たに
`AnthropicClassifier` を追加する。両者は共通の `Classifier` インターフェースを実装し、
`src/digest.ts` はどちらが注入されたかを意識しない。`config.yaml` の `llm.enabled` と
`ANTHROPIC_API_KEY` の有無で `main.ts` がどちらを注入するか決定する。Anthropic呼び出しは
素の `fetch()`(既存 `qiitaClient.ts` と同パターン)でMessages APIの `tools`(構造化出力)を
使い、失敗時は `KeywordClassifier` にフォールバックしつつ `errorType: "llm_classification_failed"`
として記録する。記事本文(タイトル・summary)はプロンプト内で `<article>` タグにより指示文と
分離する。

## Technical Context

**Language/Version**: TypeScript(strict)、Node.js(ES2022、`module`/`moduleResolution`: NodeNext)

**Primary Dependencies**: 新規の外部パッケージ追加なし。既存の `fetch()`(グローバル)のみで
Anthropic Messages APIを呼び出す(research.md #1参照)

**Storage**: N/A(既存の `logs/errors/YYYY-MM-DD.json` を再利用。新規ストレージなし)

**Testing**: vitest。`vi.stubGlobal("fetch", ...)` でAnthropic API呼び出しをモックする
(既存 `tests/publish/qiitaClient.spec.ts` と同パターン)

**Target Platform**: Node.js(ローカル実行 / GitHub Actions runner、spec 002と同じ実行環境)

**Project Type**: Single project(既存リポジトリ構造をそのまま拡張。フロントエンド/バックエンド分割なし)

**Performance Goals**: 明示的な目標値なし。1日1回のバッチ処理であり、レイテンシ要件は無い
(spec.mdでもレイテンシ目標は定義していない)

**Constraints**: オプトイン(デフォルト無効)。無効時はAnthropicへの通信が一切発生しないこと。
失敗時にdigest全体を止めないこと(spec.md要件)

**Scale/Scope**: 1回のdigest実行で扱う新規記事は数件〜十数件程度(research.md #5、バッチ単位の前提)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 判定 | 根拠 |
|---|---|---|
| I. 仕様駆動開発 | PASS | `specs/004-llm-classification/spec.md` 作成済み・要件確定済み(壁打ちで5点追加確認済み)。実装は本plan+tasks生成後 |
| II. 一方向レイヤードアーキテクチャ | PASS | `Classifier` はDESIGN.mdの「Filter/Classifier」層に属する追加コンポーネント。`Collector`/`Publisher`同様インターフェースを実装するプラグインとして追加し、既存実装を分岐で太らせない |
| III. LLMはオプトイン | PASS | 本feature自体がオプトイン機構そのもの。デフォルト(`llm.enabled: false`または`ANTHROPIC_API_KEY`未設定)では`KeywordClassifier`のみで動作し、Anthropicへの通信は発生しない |
| IV. named export・純粋関数中心 | PASS | `Classifier`/`AnthropicClassifierOptions`等はnamed export。`fetch()`呼び出しは`anthropicClassifier.ts`という「端」に閉じ込め、プロンプト構築・レスポンスパースはテスト可能な形にする |
| V. 明示的なエラーハンドリング | PASS | API失敗・パース失敗・スキーマ不一致の3ケースを明示的に定義し、フォールバック+ログ記録で digest全体を止めない設計(spec.md要件) |
| VI. 秘匿情報の絶対規約 | PASS | `ANTHROPIC_API_KEY`は環境変数からのみ取得。コード・config・テストへの直書きなし |

**再評価(Phase 1設計後)**: 上記の判定はPhase 1(data-model.md / contracts/)完了後も変わらず、
新たな違反は無い。`Complexity Tracking` への記載は不要。

## Project Structure

### Documentation (this feature)

```text
specs/004-llm-classification/
├── plan.md                              # このファイル
├── research.md                          # Phase 0 出力
├── data-model.md                        # Phase 1 出力
├── quickstart.md                        # Phase 1 出力
├── contracts/
│   ├── classifier-interface.md          # Classifierインターフェース契約
│   └── anthropic-classify-contract.md   # Anthropic Messages API呼び出し契約
└── tasks.md                             # Phase 2 出力(/speckit-tasksで生成、本plan完了後)
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── classifier.ts            # 新規: Classifier インターフェース
│   ├── anthropicClassifier.ts   # 新規: createAnthropicClassifier(fetch呼び出し・プロンプト構築・パース・フォールバック)
│   ├── topicMatcher.ts          # 既存: classify/parseTopics。KeywordClassifierとしてラップする関数を追加
│   ├── errorLog.ts              # 既存: ErrorLogEntry.errorType に "llm_classification_failed" を追加(型はstringのまま)
│   └── index.ts                 # バレル更新
├── digest.ts                    # 変更: DigestDepsにclassifier/topicsMarkdownを追加、classifyItemsをバッチ呼び出しに変更
└── main.ts                      # 変更: llm.enabled + ANTHROPIC_API_KEY の有無でKeyword/Anthropicを選択する配線を追加

tests/
├── core/
│   ├── classifier.spec.ts             # 新規: KeywordClassifierラッパーの契約テスト(既存classify()の再利用確認)
│   └── anthropicClassifier.spec.ts    # 新規: モックfetchでのAC検証(正常系・API失敗・パース失敗・スキーマ不一致・未知トピック)
└── digestClassifierInjection.spec.ts  # 新規: digest.tsがClassifierの実装を意識しないことをモックClassifierで検証
```

**Structure Decision**: 既存の単一プロジェクト構成(`src/core|render|publish|collectors`、`tests/`が
`src/`をミラー)をそのまま拡張する。新規レイヤーやディレクトリ分割は不要(`Classifier`はDESIGN.mdの
既存レイヤー「Filter/Classifier」に属するため `src/core/` に置く)。

## Complexity Tracking

*本featureはConstitution Checkの全項目をPASSしており、記載事項なし。*

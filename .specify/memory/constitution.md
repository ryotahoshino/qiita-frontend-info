# qiita-frontend-digest Constitution

## Core Principles

### I. 仕様駆動開発(NON-NEGOTIABLE)

新機能の実装は必ず `specs/NNN-機能名/spec.md` の作成と人間の承認から始める。`spec.md` には
「要件」「受け入れ条件(Given/When/Then)」「スコープ外」を必ず含める。実装前に受け入れ条件を
vitest のテストケースに落とす。テストなしで実装を開始しない。`spec.md` が存在しない機能追加の
指示を受けたら、まず仕様作成を提案する。承認されていない spec の実装を進めない。

GitHub Spec Kit のワークフロー(`/speckit-specify` 等)を使う場合も、生成される `spec.md` は
本プロジェクトの既存フォーマット(目的/要件/受け入れ条件 Given-When-Then/スコープ外/関連)に
従う。`.specify/templates/spec-template.md` はこの規約に合わせて調整済み。受け入れ条件には
vitestで自動検証できるか(`[vitest]`)、GitHub Actions等の外部環境実行でのみ検証できるか
(`[手動]`)を明記する。

### II. 一方向レイヤードアーキテクチャ

`Collector → 正規化・重複排除 → Filter/Classifier → Renderer → Publisher` の一方向。
逆方向の依存を作らない(例: core層がrender層やpublish層の型を保持しない。オーケストレーション
自体はどのレイヤーにも属さないトップレベルのモジュールに置く)。Collector と Publisher は
インターフェース(`src/collectors/types.ts`、`src/publish/` 等)を実装するプラグインとして
追加し、既存実装を分岐で太らせない。「何を拾うか」は `TOPICS.md`、「どう見せるか」は
`src/render/` のテンプレート。責務を混ぜない。`TOPICS.md` から render 層へ渡すのは
分類済みのセクション(トピック名+記事一覧)のみで、`TOPICS.md` の生テキストを渡さない。

### III. LLMはオプトイン

LLM要約・LLM分類はオプトイン。APIキーなしでもキーワードマッチのみで全機能が動くこと。
`config.yaml` の `llm.enabled` はデフォルト `false`。

### IV. named export のみ・純粋関数中心

named export のみを用い、各ディレクトリに `index.ts`(バレル)を置く。外部I/O(fetch、fs、
日時取得)は各レイヤーの端(アダプタ関数)に寄せ、コアロジックは純粋関数に保つ。日付計算は
UTCではなくJST基準で行う(`Date#toISOString()` はUTC固定のため直接使わず、
`src/core/jstDate.ts` の `formatJstDate` を使う)。

### V. 明示的なエラーハンドリング

エラーは明示的に扱う。1つのフィード取得失敗や1件の不正な記事URLで全体を止めない。
Collector追加時はフィクスチャ(実レスポンスの縮小版)を `tests/fixtures/` に置く。

### VI. 秘匿情報・公開設定の絶対規約(NON-NEGOTIABLE)

- `QIITA_TOKEN` やAPIキーをコード・config・テストに直書きしない(GitHub Secrets / 環境変数のみ)
- `config.yaml` をコミットしない(`config.yaml.example` を更新する)。CI(GitHub Actions)では
  `config.yaml.example` をそのまま `config.yaml` としてコピーして使う
- Qiita投稿のデフォルトを `private: false` に変えない(公開は人間の明示的な設定変更でのみ行う)

## Technology Stack

- TypeScript(strict)+ Node.js、パッケージマネージャは pnpm
- テスト: vitest / 実行: tsx
- 実行環境: GitHub Actions(cron `0 22 * * *` = JST朝7時、`workflow_dispatch` で手動実行可)
- 外部API: Qiita API v2(投稿)、各種RSS(`fast-xml-parser`)、config読み込みは `yaml`
- 将来: GitHub Releases API(GitHubReleasesCollector、別spec)

## 出力ファイルの規約

- 記事アーカイブ: `articles/YYYY/MM/YYYY-MM-DD.md`(JST基準の日付)
- 既出URL管理: `state.json`(ワークフロー内でコミットバック、URLはトラッキングパラメータ除去後の
  正規化済みURL)
- エラーログ: `logs/errors/YYYY-MM-DD.json`
- スキップログ: `logs/skipped/YYYY-MM-DD.json`(TOPICS.md育成の材料、spec 003で追加予定)

## 現在の進捗と今後の実装方針(Living Status)

<!-- このセクションは各specの承認・実装完了のたびに更新すること -->

| spec | 内容 | status | 実装状況 |
|---|---|---|---|
| 001-rss-collector | RSS収集 → articles/保存 → Qiita限定共有投稿の一気通貫パイプライン | done | 完了・main統合済み |
| 002-scheduled-run | GitHub Actions定期実行、config.yaml自動生成、JST日付対応、README Setup節 | done | 完了・main統合済み |
| 003-topics-filter | TOPICS.mdによるキーワードマッチフィルタリング、Rendererのトピック別セクション化 | done | 完了・main統合済み(PR #3) |
| 004-llm-classification | LLMありモード(オプトイン)。`Classifier`インターフェース化、`AnthropicClassifier`(fallback付き)、プロンプトインジェクション対策 | done | 完了・main統合済み(PR #4)。実際の`ANTHROPIC_API_KEY`での疎通確認([手動]AC)はコスト都合で保留中(spec.md参照) |
| 005-pr-trigger-ci | PRトリガーでのCI整備。`.github/workflows/ci.yml`新規追加(pull_request/main push時にtypecheck+test)、spec 002の既知のギャップを解消 | approved | 実装完了(`.github/workflows/ci.yml`、`package.json`の`typecheck`スクリプト、`tests/typecheckScript.spec.ts`等3件)。`pnpm test` 65件・`tsc --noEmit` ともにpass。実際にPRを作成してのトリガー確認([手動]AC)は未実施(要人手)。`feat/005-pr-trigger-ci` ブランチ、main未統合(PR前) |

今後の方針(`docs/DESIGN.md` ロードマップ準拠、番号は仮):

1. **005をmainへ統合**: `feat/005-pr-trigger-ci` のPRを作成・マージする(マージ後、実際に
   PRを作成して`ci.yml`がトリガーされることを人手で確認すること)
2. **GitHubReleasesCollector**(別spec、番号未定): `src/collectors/` にプラグイン追加
3. **v0.3**: `logs/skipped/` をLLMに分析させ `TOPICS.md` への追記案をPRとして自動作成

## Governance

`CLAUDE.md` と `docs/DESIGN.md` がこのConstitutionに優先する一次情報源であり、矛盾があれば
そちらに従う。本Constitutionはそれらの要点をGitHub Spec Kitのワークフロー(`/speckit-*`)向けに
要約・翻訳したものである。Constitutionを変更する場合は `CLAUDE.md` / `docs/DESIGN.md` との
整合を確認すること。「現在の進捗と今後の実装方針」セクションは spec の承認・実装完了のたびに
更新し、実際の `specs/` ディレクトリの状態と乖離させない。

**Version**: 1.0.0 | **Ratified**: 2026-07-25 | **Last Amended**: 2026-07-25

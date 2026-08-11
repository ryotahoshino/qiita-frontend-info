---

description: "Task list for spec 004: LLMありモード(オプトイン分類)"
---

# Tasks: LLMありモード(オプトイン分類)

**Input**: Design documents from `specs/004-llm-classification/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: 本プロジェクトのConstitution Principle I(仕様駆動開発、NON-NEGOTIABLE)により、
実装前に受け入れ条件をvitestのテストケースに落とすことが必須。すべてのテストタスクは
対応する実装タスクより前に実行し、実装前は失敗する状態であることを確認する。

**Organization**: このプロジェクトのspec.mdはGitHub Spec Kit標準のUser Story形式を使わないため、
タスクは spec.md の要件区分(Classifierインターフェース/AnthropicClassifier/digest.ts統合/
main.ts配線)に沿ってグルーピングする。`[Story]` ラベルはこれらの区分名を使う。

## Format: `[ID] [P?] [Group] Description`

- **[P]**: 並列実行可能(別ファイル・依存なし)
- **[Group]**: `CLASSIFIER` / `ANTHROPIC` / `DIGEST` / `MAIN` のいずれか(Foundational/Polishには付けない)

## Path Conventions

既存の単一プロジェクト構成(`src/`, `tests/` がリポジトリ直下)をそのまま使う。

---

## Phase 1: Setup

**Purpose**: 依存関係の追加

research.md #1の決定により新規npm依存パッケージは追加しない(既存の `fetch()` を使う)。
Setupタスクは無し。

---

## Phase 2: Foundational — Classifierインターフェース(CLASSIFIER)

**Purpose**: `AnthropicClassifier`/`digest.ts統合`の両方が依存する土台。このフェーズ完了まで
Phase 3以降は着手できない。

- [X] T001 [P] `tests/core/classifier.spec.ts` に `createKeywordClassifier()` の契約テストを書く
      (既存の `classify()` と同じ結果を返すことを確認。`Classifier`/`createKeywordClassifier`は
      未実装のため、この時点でテストは失敗する) — contracts/classifier-interface.md 準拠
- [X] T002 `src/core/classifier.ts` に `Classifier` インターフェースを定義する
      (data-model.md「Classifier」参照)
- [X] T003 `src/core/topicMatcher.ts` に `createKeywordClassifier(): Classifier` を追加する
      (既存の `classify(item, topics)` を `items.map()` でラップし、`topicsMarkdown` 引数は
      無視する)
- [X] T004 `src/core/index.ts` バレルに `classifier.js` のexportを追加する

**Checkpoint**: T001のテストがgreenになる。`Classifier` インターフェースと既定実装
(`KeywordClassifier`)が揃い、Phase 3・Phase 4が着手可能になる。

---

## Phase 3: AnthropicClassifier(ANTHROPIC)

**Goal**: Anthropic Messages APIを呼び出し、失敗時は`KeywordClassifier`にフォールバックする
`Classifier`実装を追加する。

**Independent Test**: `tests/core/anthropicClassifier.spec.ts` を単体で実行し、モックした
`fetch`のみで全ケース(正常系・API失敗・パース失敗・スキーマ不一致・未知トピック)を検証できる
(digest.ts側の変更を待たずに完結する)。

### Tests for ANTHROPIC ⚠️ 実装より先に書き、失敗を確認する

- [X] T005 [P] [ANTHROPIC] `tests/core/anthropicClassifier.spec.ts`: 正常系
      — モックfetchが妥当なtool_use応答を返すとき、送信されたリクエストの `system` に
      指示文のみ、`messages[0].content` に `<article>` タグで区切られた記事データが含まれる
      ことを検証(spec.md AC「プロンプトの分離」)
- [X] T006 [P] [ANTHROPIC] 同ファイル: モックfetchがHTTPエラー/ネットワークエラーを返すとき、
      `fallback.classify()` の結果が返り、`logError` が `errorType: "llm_classification_failed"`
      で1回呼ばれることを検証
- [X] T007 [P] [ANTHROPIC] 同ファイル: モックfetchの応答がJSONとしてパースできないとき、
      T006と同様にフォールバック・ログを検証
- [X] T008 [P] [ANTHROPIC] 同ファイル: モックfetchの応答はJSONとして妥当だがスキーマ不一致
      (`topic`/`relevance` 欠落等)のとき、T006と同様にフォールバック・ログを検証
- [X] T009 [P] [ANTHROPIC] 同ファイル: モックfetchの応答はスキーマとして妥当だが `topics` に
      存在しない `topic` を含む記事が1件あるとき、フォールバックは発生せず当該記事のみ
      `relevance: "skip"` になり、他の記事は分類結果がそのまま使われることを検証

### Implementation for ANTHROPIC

- [X] T010 [ANTHROPIC] `src/core/errorLog.ts` の `ErrorLogEntry` にコメントで
      `errorType: "llm_classification_failed"` の規約を明記する(data-model.md「ErrorLogEntry」)
- [X] T011 [ANTHROPIC] `src/core/anthropicClassifier.ts` に
      `createAnthropicClassifier(options: AnthropicClassifierOptions): Classifier` を実装する
      (contracts/anthropic-classify-contract.md のリクエスト/レスポンス形状・処理フローに従う。
      T005〜T009 が green になることを確認する)
- [X] T012 [ANTHROPIC] `src/core/index.ts` バレルに `anthropicClassifier.js` のexportを追加する

**Checkpoint**: `tests/core/anthropicClassifier.spec.ts` の全ケースがgreen。
`AnthropicClassifier` は `digest.ts` の変更を待たずに単体で完結して動作確認できる。

---

## Phase 4: digest.ts統合(DIGEST)

**Goal**: `src/digest.ts` が `Classifier` を実装非依存の依存として受け取り、注入された
`Classifier` の結果だけで動作するようにする。

**Independent Test**: `tests/digestClassifierInjection.spec.ts` をモックの `Classifier` で
実行し、`digest.ts` がKeyword/Anthropicの実装差を意識しないことを確認する。

**Depends on**: Phase 2(`Classifier` 型が必要)。Phase 3の完了は待たなくてもよい
(モックの `Classifier` で検証するため)。

### Tests for DIGEST ⚠️ 実装より先に書き、失敗を確認する

- [X] T013 [P] [DIGEST] `tests/digestClassifierInjection.spec.ts` を新規作成し、モックの
      `Classifier`(任意の分類結果を返す)を `DigestDeps.classifier` に注入して `digest` を
      実行し、`articles/` 生成・`state.json` 記録・`logs/skipped/` 記録が注入された分類結果を
      そのまま使うことを検証する(spec.md AC「Classifierインターフェース・digest.ts側」)

### Implementation for DIGEST

- [X] T014 [DIGEST] `src/digest.ts` の `DigestDeps` に `classifier: Classifier` と
      `topicsMarkdown: string` を追加し、`classifyItems` を
      `deps.classifier.classify(items, deps.topics, deps.topicsMarkdown)` によるバッチ呼び出しに
      変更する(1件ずつ `classify()` を直接importして呼んでいた既存実装を置き換える。
      data-model.md「DigestDeps」参照)
- [X] T015 [DIGEST] `tests/digest.spec.ts` と `tests/topicsFilter.spec.ts` の `makeDeps` に
      `classifier`(キャッチオールトピックと同等の挙動をするモック `Classifier`)と
      `topicsMarkdown`(空文字列でよい)を追加する。**既存テスト本体(`it()`の中身)は変更しない**
      (spec 002/003のリファクタ時と同じ方針。既存33件超のテストの意図を保つ)

**Checkpoint**: T013がgreenになり、かつ `tests/digest.spec.ts`・`tests/topicsFilter.spec.ts`
が既存のまま(本体無変更で)引き続きgreenであることを確認する。

---

## Phase 5: main.ts配線(MAIN)

**Goal**: `config.yaml` の `llm.enabled` と `ANTHROPIC_API_KEY` の有無に応じて、実際に使う
`Classifier` を選択する配線を行う。

**Depends on**: Phase 3・Phase 4の完了。

- [X] T016 [MAIN] `src/main.ts` で `TOPICS.md` の生テキスト(`topicsMarkdown`)を保持したまま
      `DigestDeps` に渡し、`config.qiita.llm.enabled` かつ `process.env.ANTHROPIC_API_KEY` が
      設定されている場合のみ `createAnthropicClassifier({ apiKey, fallback: createKeywordClassifier(), logError })`
      を、それ以外は `createKeywordClassifier()` を `classifier` として注入する

**Checkpoint**: `pnpm run digest` が(config.yaml未作成時のエラーメッセージも含め)従来通り
起動できる。

---

## Phase 6: Polish & 検証

**Purpose**: 全体の整合性確認とドキュメント更新

- [X] T017 [P] `pnpm test` を実行し全件green、`tsc --noEmit` をエラーゼロにする
      (ループで修正する。前提: T001〜T016完了)
- [ ] T018 [P] `specs/004-llm-classification/quickstart.md` の手動検証(実際の
      `ANTHROPIC_API_KEY` での疎通確認、spec.mdの `[手動]` AC)を実施する
- [X] T019 `.specify/memory/constitution.md` の「現在の進捗と今後の実装方針」表を
      spec 004実装完了に更新する
- [ ] T020 変更をコミットする(CLAUDE.md/Constitution の「作業単位ごとにコミット」規約に従う)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: タスク無し
- **Foundational (Phase 2)**: 依存なし。Phase 3・4をブロックする
- **ANTHROPIC (Phase 3)**: Phase 2完了後に開始可能。DIGEST(Phase 4)の完了を待たない
- **DIGEST (Phase 4)**: Phase 2完了後に開始可能。ANTHROPIC(Phase 3)の完了を待たない
  (モックの`Classifier`で検証するため独立)
- **MAIN (Phase 5)**: Phase 3・Phase 4の両方が完了してから開始
- **Polish (Phase 6)**: 全フェーズ完了後

### Parallel Opportunities

- Phase 3のテストタスク(T005〜T009)はすべて同一ファイルへの追記のため、実際には順次実行が
  安全(内容は独立しているが同一ファイル競合を避ける)
- Phase 3(ANTHROPIC)とPhase 4(DIGEST)はPhase 2完了後、互いに独立して並行着手できる
- T017とT018は互いに独立して並行実行できる

---

## Parallel Example: Phase 2完了後

```text
# ANTHROPIC と DIGEST は互いに依存しないため並行着手可能
Task: "T005-T012 (ANTHROPIC): AnthropicClassifierの実装とテスト"
Task: "T013-T015 (DIGEST): digest.tsのClassifier注入対応"
```

---

## Implementation Strategy

### 推奨する完了順序

1. Phase 2(Foundational)を完了する — これが無いと何も進められない
2. Phase 3(ANTHROPIC)とPhase 4(DIGEST)を進める(順不同・並行可)
3. Phase 5(MAIN)で両者を配線する
4. Phase 6で全体検証・ドキュメント更新・コミット

### 各タスク完了後

- テストタスクの直後に対応する実装タスクを行い、テストがredからgreenになったことを確認する
- 論理的な単位(1 Phaseの完了時など)でコミットする

## Notes

- `[P]` タスク = 別ファイル・依存なし
- `[Group]` ラベルはこのプロジェクトの要件区分に対応する追跡用ラベル(GitHub Spec Kit標準の
  ユーザーストーリーではない)
- 実装前にテストがfailすることを確認する
- 既存テスト(`tests/digest.spec.ts`, `tests/topicsFilter.spec.ts`)の本体は変更せず、
  `makeDeps` の接続部分のみ更新する

---

description: "Task list for spec 005: PRトリガーでのCI整備"
---

# Tasks: PRトリガーでのCI整備

**Input**: Design documents from `specs/005-pr-trigger-ci/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: `.specify/memory/constitution.md` Principle I(仕様駆動開発、NON-NEGOTIABLE)により、
実装前に受け入れ条件をvitestのテストケースに落とすことが必須。テストタスクは対応する実装
タスクより前に実行し、実装前は失敗する状態であることを確認する。

**Organization**: このプロジェクトのspec.mdはUser Story形式を使わないため、タスクはspec.mdの
要件区分(TESTS/WORKFLOW/DOCS)に沿ってグルーピングする。`[Group]`ラベルはこれらの区分名を使う。

## Format: `[ID] [P?] [Group] Description`

## Path Conventions

既存の単一プロジェクト構成(`.github/workflows/`, `tests/`, `package.json`がリポジトリ直下)を
そのまま使う。

---

## Phase 1: Setup

新規npm依存パッケージは追加しない(research.md参照)。Setupタスクは無し。

---

## Phase 2: テスト(TESTS)⚠️ 実装より先に書き、失敗を確認する

**Goal**: `ci.yml`・`package.json`の`typecheck`スクリプトが未実装の状態でこれらを検証する
vitestテストを先に用意する。

- [X] T001 [P] [TESTS] `tests/typecheckScript.spec.ts` を新規作成し、`package.json`を読み込んで
      `scripts.typecheck` が `"tsc --noEmit -p tsconfig.json"` であることを検証する
      (data-model.md「package.json scripts」参照。この時点では`typecheck`スクリプトが
      存在しないため失敗する)
- [X] T002 [P] [TESTS] `tests/workflowVersions.spec.ts` を新規作成し、`yaml`パッケージで
      `.github/workflows/daily.yml` と `.github/workflows/ci.yml` をパースし、
      `pnpm/action-setup@`で始まる`uses`のstepの`with.version`、`actions/setup-node@`で
      始まる`uses`のstepの`with.node-version`をそれぞれ抽出して一致することを検証する
      (research.md #1、data-model.md「WorkflowActionVersion」参照。`ci.yml`が存在しないため
      失敗する)
- [X] T003 [P] [TESTS] `tests/ciSecrets.spec.ts` を新規作成し、`.github/workflows/ci.yml` の
      生テキストに文字列 `secrets.` が含まれないことを検証する(research.md #2参照。
      `ci.yml`が存在しないため失敗する)

**Checkpoint**: T001〜T003がすべて失敗することを確認してから実装に進む。

---

## Phase 3: ワークフロー実装(WORKFLOW)

**Goal**: `package.json`の`typecheck`スクリプトと`.github/workflows/ci.yml`を実装し、
T001〜T003をgreenにする。

- [X] T004 [WORKFLOW] `package.json` の `scripts` に
      `"typecheck": "tsc --noEmit -p tsconfig.json"` を追加する(T001が green になることを確認する)
- [X] T005 [WORKFLOW] `.github/workflows/ci.yml` を新規作成する。
      トリガー: `pull_request`(branches: `[main]`)と`push`(branches: `[main]`)。
      ジョブ: `ubuntu-latest`、`actions/checkout@v4` → `pnpm/action-setup@v4`(version: 9)→
      `actions/setup-node@v4`(node-version: 22, cache: pnpm)→
      `pnpm install --frozen-lockfile` → `pnpm run typecheck` → `pnpm test`。
      `secrets.`を参照する`env:`は一切追加しない(data-model.md「.github/workflows/ci.yml
      の構造」参照。T002・T003が green になることを確認する)

**Checkpoint**: `tests/typecheckScript.spec.ts`・`tests/workflowVersions.spec.ts`・
`tests/ciSecrets.spec.ts` がすべてgreenになる。

---

## Phase 4: ドキュメント更新(DOCS)

- [X] T006 [DOCS] `README.md` の `Setup` 節に、ブランチ保護ルール
      (`Settings > Branches > Branch protection rules` で `main` に対し
      「Require status checks to pass before merging」を有効化し、`ci.yml`のジョブを
      必須チェックに追加する)の**手順**を記載する(実際の設定操作自体はスコープ外。
      spec 002のQIITA_TOKEN登録手順の記載パターンに合わせる)
- [X] T007 [DOCS] `specs/002-scheduled-run/spec.md` の「スコープ外」にある
      「PR時に`pnpm test`を自動実行するCIの追加。現状PRトリガーのテスト実行が無いため...
      既知のギャップとして残す」という記述を、spec 005で解消済みである旨に更新する

---

## Phase 5: Polish & 検証

- [X] T008 [P] `pnpm test` を実行し全件green、`tsc --noEmit` をエラーゼロにする
      (ループで修正する。前提: T001〜T005完了)
- [ ] T009 [P] (未実施・要人手) `specs/005-pr-trigger-ci/quickstart.md` の手動検証(実際にPull Requestを
      作成し `ci.yml` がトリガーされることの確認、spec.mdの`[手動]`AC)を実施する
- [X] T010 変更をコミットする(CLAUDE.md/Constitution の「作業単位ごとにコミット」規約に従う)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: タスク無し
- **TESTS (Phase 2)**: 依存なし。T001〜T003は並行して書ける(異なるファイル)
- **WORKFLOW (Phase 3)**: Phase 2のテストが存在することが前提(先に書いて失敗を確認する)。
  T004はT001に、T005はT002・T003に対応する
- **DOCS (Phase 4)**: Phase 3完了後(README記載はci.ymlの実体を前提とするため)
- **Polish (Phase 5)**: 全フェーズ完了後

### Parallel Opportunities

- T001・T002・T003は互いに異なるファイルのため並行して書ける
- T006・T007は互いに独立したドキュメント更新のため並行できる
- T008・T009は互いに独立して並行実行できる

---

## Parallel Example: Phase 2

```text
Task: "T001 tests/typecheckScript.spec.ts を書く"
Task: "T002 tests/workflowVersions.spec.ts を書く"
Task: "T003 tests/ciSecrets.spec.ts を書く"
```

---

## Implementation Strategy

1. Phase 2(テスト)を先に書き、全て失敗することを確認する
2. Phase 3(package.json・ci.yml)を実装し、Phase 2のテストをgreenにする
3. Phase 4(README・spec 002更新)でドキュメントを整合させる
4. Phase 5で全体検証・手動確認・コミット

## Notes

- `[P]`タスク = 別ファイル・依存なし
- `[Group]`ラベルはこのプロジェクトの要件区分に対応する追跡用ラベル(GitHub Spec Kit標準の
  ユーザーストーリーではない)
- 実装前にテストがfailすることを確認する

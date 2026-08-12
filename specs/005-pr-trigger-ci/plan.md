# Implementation Plan: PRトリガーでのCI整備

**Branch**: `005-pr-trigger-ci` | **Date**: 2026-08-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-pr-trigger-ci/spec.md`

## Summary

`.github/workflows/ci.yml` を新規追加し、`pull_request`(main宛)と`main`へのpushをトリガーに
`pnpm run typecheck` → `pnpm test` を実行する。既存の`daily.yml`は変更しない。Node/pnpmの
バージョン設定は`daily.yml`と一致させ、`tests/`配下に両ワークフローの整合性・シークレット
不参照・typecheckスクリプト定義を検証するvitestテストを追加してdriftを防ぐ。

## Technical Context

**Language/Version**: TypeScript(strict)、Node.js(ES2022、NodeNext)。CI設定自体はYAML
(GitHub Actions)

**Primary Dependencies**: 新規パッケージ追加なし。既存の`yaml`パッケージ(`src/config.ts`で
使用中)をテストのYAMLパースに再利用する

**Storage**: N/A

**Testing**: vitest。ワークフローYAML・`package.json`をファイルシステムから読み込んでパースし、
構造を検証する(既存の`tests/configExample.spec.ts`と同様、実ファイルを対象にした回帰テスト)

**Target Platform**: GitHub Actions(`ubuntu-latest`)。既存`daily.yml`と同一ランナー

**Project Type**: Single project(既存リポジトリ構造をそのまま拡張)

**Performance Goals**: 明示的な目標値なし。PR毎に実行される軽量なCIであること

**Constraints**: シークレット不要(既存テストがすべて外部I/Oをモック化済みのため、実行に
APIキー・トークンを要しない)。既存`daily.yml`を変更しない

**Scale/Scope**: 単一ワークフローファイルの追加、`package.json`に1スクリプト追加、
新規vitestテスト3本程度

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 判定 | 根拠 |
|---|---|---|
| I. 仕様駆動開発 | PASS | `specs/005-pr-trigger-ci/spec.md`作成・チェックリスト全項目パス済み。実装は本plan+tasks生成後 |
| II. 一方向レイヤードアーキテクチャ | PASS(N/A) | アプリケーションのCollector/Renderer等のレイヤーに影響しない、CI設定の追加のみ |
| III. LLMはオプトイン | PASS(N/A) | 本specはLLM関連機能を含まない |
| IV. named export・純粋関数中心 | PASS | 新規vitestテストはfsから読み込んだ内容をパースする形で、既存の`configExample.spec.ts`と同じスタイルに従う |
| V. 明示的なエラーハンドリング | PASS(N/A) | CI設定自体にランタイムのエラーハンドリングは発生しない(GitHub Actionsの標準的な失敗検知に委ねる) |
| VI. 秘匿情報の絶対規約 | PASS | `ci.yml`はシークレットを一切参照しない設計とし、そのこと自体をvitestで検証する |

**再評価(Phase 1設計後)**: Phase 1の設計(data-model.md)完了後も判定は変わらず、新たな違反は
無い。`Complexity Tracking`への記載は不要。

## Project Structure

### Documentation (this feature)

```text
specs/005-pr-trigger-ci/
├── plan.md              # このファイル
├── research.md          # Phase 0 出力
├── data-model.md         # Phase 1 出力
├── quickstart.md        # Phase 1 出力
└── tasks.md             # Phase 2 出力(/speckit-tasksで生成、本plan完了後)
```

contracts/ は作成しない(research.md「contracts/ を作成しない理由」参照。本specは外部公開
インターフェースを持たないCI設定の追加のため)。

### Source Code (repository root)

```text
.github/
└── workflows/
    ├── daily.yml    # 既存、変更しない
    └── ci.yml       # 新規: pull_request(main宛)・main pushトリガー、typecheck→test

package.json          # 変更: scripts.typecheck を追加

tests/
├── workflowVersions.spec.ts  # 新規: daily.yml と ci.yml の pnpm/node バージョン整合を検証
├── ciSecrets.spec.ts         # 新規: ci.yml が secrets. を参照しないことを検証
└── typecheckScript.spec.ts   # 新規: package.json の typecheck スクリプト定義を検証
```

**Structure Decision**: 既存の単一プロジェクト構成をそのまま使う。新しいディレクトリは作らず、
`.github/workflows/`に1ファイル追加、`tests/`直下に検証用テストを3ファイル追加する
(既存の`tests/configExample.spec.ts`と同じ「直下に置く」慣習に合わせる。ワークフロー検証は
特定の`src/`モジュールに対応しないcrosscuttingなテストのため、`tests/core/`等のサブディレクトリ
ではなく直下に置く)。

## Complexity Tracking

*本featureはConstitution Checkの全項目をPASSしており、記載事項なし。*

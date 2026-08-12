# データモデル: PRトリガーでのCI整備

このspecはアプリケーションのデータエンティティを追加しない。ここでは新規テストが検証する
「ワークフロー設定の形」と、追加する`package.json`スクリプトの形を記載する。

## .github/workflows/ci.yml の構造(検証対象)

| 項目 | 値 |
|---|---|
| `on.pull_request.branches` | `[main]` |
| `on.push.branches` | `[main]` |
| `jobs.test.runs-on` | `ubuntu-latest` |
| `jobs.test.steps` | checkout → pnpm/action-setup(version: 9)→ setup-node(node-version: 22, cache: pnpm)→ `pnpm install --frozen-lockfile` → `pnpm run typecheck` → `pnpm test` |
| secrets参照 | 無し(`env:`ブロック自体を持たない) |

## WorkflowActionVersion(vitestが抽出する値、型のみ)

`tests/workflowVersions.spec.ts` が `daily.yml` / `ci.yml` それぞれから抽出する値。

| フィールド | 型 | 抽出元 |
|---|---|---|
| `pnpmVersion` | `string` | `uses`が`pnpm/action-setup@`で始まるstepの`with.version` |
| `nodeVersion` | `string \| number` | `uses`が`actions/setup-node@`で始まるstepの`with.node-version` |

**不変条件**: `daily.yml`から抽出した値と`ci.yml`から抽出した値が、それぞれ完全一致する。

## package.json scripts(追加)

| script名 | コマンド | 用途 |
|---|---|---|
| `typecheck`(新規) | `tsc --noEmit -p tsconfig.json` | ローカル・CI共通の型チェックコマンド |

既存の `digest` / `test` / `test:watch` はそのまま維持する。

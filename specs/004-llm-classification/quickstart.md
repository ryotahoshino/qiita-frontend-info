# Quickstart: LLMありモードの検証

## 前提

- `pnpm install` 済み
- `config.yaml`(`config.yaml.example` からコピー)が存在する

## 1. デフォルト動作(LLM無効)の確認

```powershell
pnpm test
```

`tests/core/topicMatcher.spec.ts`・`tests/digest*.spec.ts` 等が引き続き通ることを確認する
(spec 003時点の挙動に対する回帰が無いこと)。`config.yaml` の `llm.enabled` は既定で `false`
のため、`pnpm run digest` を実行してもAnthropic APIへの通信は発生しない。

## 2. モックによるAnthropicClassifierの検証(自動テスト)

```powershell
pnpm test tests/core/anthropicClassifier.spec.ts
```

`vi.stubGlobal("fetch", ...)` でAnthropic API呼び出しをモックし、spec.mdの `[vitest]`
受け入れ条件(正常系・API失敗・パース失敗・スキーマ不一致・未知トピック名)を検証する。

## 3. 実際のAnthropic APIでの疎通確認(手動、spec.mdの`[手動]`AC)

```powershell
$env:QIITA_TOKEN = ""  # 投稿はスキップしたい場合は空のままでよい
$env:ANTHROPIC_API_KEY = "<実際のAPIキー>"
```

`config.yaml` を編集:

```yaml
llm:
  enabled: true
```

```powershell
pnpm run digest
```

**期待される結果**:
- コンソール/ログにAnthropic API呼び出し失敗のエラーが出ない
- `articles/YYYY/MM/YYYY-MM-DD.md` が生成され、`TOPICS.md` のトピックごとにセクション分けされている
- `logs/errors/YYYY-MM-DD.json` に `llm_classification_failed` が**記録されていない**こと
  (記録されていた場合はフォールバックが発生しており、Anthropic呼び出しか応答形式に問題がある)

**確認後の後片付け**: この手動検証で生成された `articles/`・`state.json`・`logs/` の変更は、
テスト目的の場合はコミットせず `git checkout -- state.json` 等で元に戻す。

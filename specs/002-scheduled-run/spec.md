# 002: GitHub Actionsでの定期実行とコミットバック確立

- status: draft(← Claude Codeと壁打ちして固め、承認したら approved に変更)

## 目的(なぜ作るか)

GitHub Actions上で毎日自動実行し、`state.json` と `articles/` がコミットバックされる状態を確立する。

現状の `.github/workflows/daily.yml` は cron トリガー・`pnpm run digest` 実行・コミットバックの骨格を持つが、
`config.yaml` は CLAUDE.md の規約でコミット禁止(`.gitignore` 対象)のため、CI 環境には存在しない。
このままでは `pnpm run digest` が「config.yaml が見つかりません」で毎日必ず失敗する。
本specでは、このギャップを埋めて「人手を介さず、cron起動→収集→articles/保存→state更新→コミット&push まで完走する」状態を確立する。

## 要件(何ができればよいか)

- `daily.yml` は cron(`0 22 * * *` = JST 翌朝7:00)で自動起動する
- `workflow_dispatch` により手動実行もできる(動作確認用)
- ワークフロー内で `config.yaml.example` を `config.yaml` としてコピーし、`pnpm run digest` が実行できる状態を用意する(実運用のフィード構成は `config.yaml.example` の内容とする)
- `QIITA_TOKEN` は GitHub Secrets から環境変数として `pnpm run digest` に渡す
- `pnpm run digest` の実行後、`state.json` / `articles/` / `logs/` に変更があれば `github-actions[bot]` としてコミットし、リモートへ push する
- 変更が無い場合は空コミットを作らない
- `pnpm run digest` が異常終了(exit code 非0)した場合、コミット・pushは行われず、ワークフロー自体も失敗として記録される
- `config.yaml.example` は常に `parseConfig`(spec 001, `src/config.ts`)でエラーなくパースできる内容を維持する(CI起動の前提となるため)
- ワークフロー環境に `TZ: Asia/Tokyo` を設定する
- `articles/` のファイル名や Qiita投稿タイトルに使う日付は、UTCではなく **JST基準** で算出する。
  ランナーの実行時刻は UTC(cron `0 22 * * *` = JST 翌朝7:00)であり、日付計算がUTC基準のままだと
  JSTでの「その日」の記事が前日日付のファイルになってしまう。
  なお `Date.prototype.toISOString()` は常にUTCを返す仕様のため、**ワークフローに `TZ: Asia/Tokyo` を
  設定するだけでは修正されない**(TZはローカル時刻系メソッドにのみ影響し、`toISOString()`には影響しない)。
  日付フォーマット処理自体を、`Intl.DateTimeFormat`に`timeZone: "Asia/Tokyo"`を明示するなどTZ環境変数の
  設定有無に依存しない形でJST基準に直すか、少なくともTZ設定と整合する実装(`toISOString()`をやめ
  ローカル時刻系メソッドに置き換える等)に修正する必要がある。この修正は spec 001 で実装済みの
  日付フォーマット処理(`articles/`のパス生成・Markdown生成・Qiita投稿タイトル生成)にまたがるため、
  実装時は該当箇所を横断的に洗い出すこと
- README.md の `Setup` 節(現状 `<!-- TODO: トークン発行 → Secrets登録 → config.yaml編集 の手順 -->` の
  プレースホルダのみ)に、Qiitaトークンの発行・GitHub Secretsへの登録・`config.yaml`編集の手順を記載する

## 受け入れ条件

各項目に検証方法を付記する。`[vitest]` は自動テストで検証し、`[手動]` は `workflow_dispatch` で実際にワークフローを実行して確認する(GitHub Actions側の挙動はvitestで直接検証できないため)。

- `[vitest]` Given: `config.yaml.example` の内容 / When: `parseConfig` でパースする
  Then: 例外を投げず、`url` を持つ `feeds` を1件以上含む `Config` を返す

- `[手動]` Given: リポジトリに `config.yaml` が存在しない(通常状態) / When: ワークフローを実行する
  Then: `cp config.yaml.example config.yaml` 相当のステップにより `config.yaml` が生成され、
        後続の `pnpm run digest` が「config.yamlが見つかりません」エラーにならず処理を開始する

- `[手動]` Given: フィードに未読記事がある状態 / When: `workflow_dispatch` でワークフローを手動実行する
  Then: ジョブが成功(緑)で完了し、`articles/` に当日ファイルが生成され `state.json` が更新され、
        それらが `github-actions[bot]` 名でコミットされリモートブランチに push されている

- `[手動]` Given: 前回実行からフィードに新着記事が無い状態 / When: `workflow_dispatch` で実行する
  Then: ジョブは成功するが、新規コミットは作成されない(空コミットが増えない)

- `[手動]` Given: `QIITA_TOKEN` がリポジトリのSecretsに設定されている / When: ワークフローを実行する
  Then: Qiitaへの投稿が行われる(`private: true` の限定共有)。ワークフローのログにトークン文字列自体が
        出力されないことも確認する

- `[手動]` Given: `pnpm run digest` が(例: config.yaml.example の破損等で)異常終了する状態 / When: ワークフローが実行される
  Then: コミット・pushステップは実行されず、ワークフロー全体が failed(赤)として記録される

- `[手動]` Given: cronスケジュール(`0 22 * * *`)が設定されている状態 / When: UTC 22:00になる
  Then: ワークフローが自動的にトリガーされる(GitHub Actionsの実行履歴で確認。即時に検証できないため、
        翌日以降の実行履歴確認、または `workflow_dispatch` による代替確認で判断する)

- `[手動]` Given: cron が UTC 22:00(= JST 翌朝7:00)に発火し記事を収集する / When: ワークフローが実行される
  Then: `articles/` に生成されるファイル名の日付が **JST基準の日付**になる
        (UTC日付である前日日付の `YYYY-MM-DD.md` にはならない)

- `[vitest]` Given: UTC 22:00(= JST翌7:00)に相当する `Date` インスタンス / When: 日付フォーマット処理で
  日付文字列に変換する
  Then: JST基準の日付(UTC側の「当日」ではなく翌日)が返る

## スコープ外(今回やらないこと)

- `git push` 競合時のリトライ・rebase処理(cron 1日1回 + 手動実行のみを想定した最小構成のため)
- 複数ジョブの同時実行を防ぐ `concurrency` 制御
- ワークフロー失敗時のSlack/メール等の通知連携
- `config.yaml.example` 以外の実運用フィード構成(GitHub Repository Variables経由の設定切り替えなど)
- GithubReleasesCollector(→ 002ではなく既存どおり別spec)、TOPICS.mdフィルタ(→ 003)
- **QIITA_TOKEN を GitHub Secretsへ実際に登録する操作そのもの**(GitHub UI上でリポジトリ所有者が行う
  一度きりの手動作業であり、コードやワークフローとして実装できるものではないため)。
  本specの要件に含めるのは、その**手順をREADME.mdに文書化すること**までであり、登録作業自体はスコープ外

## 関連

- docs/DESIGN.md「パイプライン全体像」「GitHub Actions」
- `.github/workflows/daily.yml`
- specs/001-rss-collector/spec.md(`pnpm run digest` / `config.ts` の前提)

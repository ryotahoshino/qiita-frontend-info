# 005: PRトリガーでのCI整備

- status: draft(← Claude Codeと壁打ちして固め、承認したら approved に変更)

## 目的(なぜ作るか)

Pull Request作成・更新時、および `main` へのpush時に自動で `pnpm test` と型チェックを実行し、
マージ前の安全網を機能させる。

spec 002の「スコープ外」に「既知のギャップ」として明記した以下の問題を解消する:
「PRトリガーの `pnpm test` 実行が存在せず、`config.yaml.example` の検証テストが手動実行しない
限り安全網として機能しない」。現状、テストはローカルで手動実行しない限りマージ前に検証されず、
`config.yaml.example` の妥当性チェック(spec 002 AC)を含む全テストがCI未接続のまま放置されている。

## 要件(何ができればよいか)

- 新規ワークフローファイル `.github/workflows/ci.yml` を追加する。既存の `.github/workflows/daily.yml`
  は変更しない
- トリガーは以下の2つとする
  - `pull_request`(base: `main`)
  - `push`(`main` ブランチへの直接push・マージコミットを含む)
- 実行内容は次の2つ
  - `pnpm test`(vitest全件)
  - 型チェック(`tsc --noEmit -p tsconfig.json`)
- `package.json` に `typecheck` スクリプト(`tsc --noEmit -p tsconfig.json`)を追加し、
  CIからは `pnpm run typecheck` を呼ぶ形にする(ローカル開発でも同じコマンドで実行できるようにする)
- Node・pnpmのバージョンとキャッシュ設定は `daily.yml` と揃える
  (`pnpm/action-setup@v4` version `9`、`actions/setup-node@v4` `node-version: 22`、`cache: pnpm`)
- `pnpm install` は `--frozen-lockfile` を使う(`daily.yml` と同様)
- シークレットを一切必要としない構成にする(`QIITA_TOKEN` ・ `ANTHROPIC_API_KEY` などは
  `ci.yml` のどのステップでも参照しない。既存テストはすべて外部I/Oをモック化しているため
  実キーは不要)
- テストまたは型チェックが失敗した場合、`ci.yml` のジョブ自体が失敗(赤)としてGitHub上の
  PRチェックに表示される(追加の通知連携は行わない)
- README.mdに、ブランチ保護ルール(`ci.yml` のチェックをマージ必須にする設定)の**手順**を
  記載する(spec 002の「QIITA_TOKENのSecrets登録手順をREADMEに記載する」と同じ扱い。
  実際にGitHub UI上で設定する操作自体はスコープ外)
- 本spec実装後、spec 002の「スコープ外」にある「PR時に `pnpm test` を自動実行するCIの追加」の
  既知のギャップの記述を、解消済みである旨に更新する

## 受け入れ条件

各項目に検証方法を付記する。`[vitest]` はワークフローYAML自体を検証する自動テストで、
`[手動]` は実際にPRやpushをトリガーしてGitHub Actions上の挙動を確認するものとする
(GitHub Actionsの実行結果自体はvitestで直接検証できないため)。

- `[vitest]` Given: `.github/workflows/ci.yml` と `.github/workflows/daily.yml` の内容
  / When: 両ファイルをYAMLとしてパースし、`pnpm/action-setup` の `version` と
  `actions/setup-node` の `node-version` を比較する
  Then: 両方の値が一致している(バージョン設定の分岐・drift を防ぐ回帰テスト)

- `[vitest]` Given: `.github/workflows/ci.yml` の内容 / When: YAMLとしてパースする
  Then: どのステップにも `secrets.` を参照する箇所が存在しない
        (シークレット不要構成であることの検証)

- `[vitest]` Given: `package.json` の `scripts` / When: 内容を確認する
  Then: `typecheck` スクリプトが `tsc --noEmit -p tsconfig.json` 相当のコマンドとして
        定義されている

- `[手動]` Given: `main` へのPull Requestを作成する / When: PRが作成・更新される
  Then: `ci.yml` が自動的にトリガーされ、`pnpm test` と型チェックがPRのチェックとして実行される

- `[手動]` Given: PR内にvitestが失敗するコード変更が含まれる / When: `ci.yml` が実行される
  Then: ジョブが失敗(赤)になり、PRのチェックに反映される(マージ前に気づける)

- `[手動]` Given: PR内に型エラーを含むコード変更がある / When: `ci.yml` が実行される
  Then: `typecheck` ステップが失敗し、ジョブ全体が失敗(赤)になる

- `[手動]` Given: `main` ブランチへ直接pushする(PRマージによるものを含む)
  / When: pushイベントが発生する
  Then: `ci.yml` がトリガーされ、`pnpm test` ・型チェックが実行される

- `[手動]` Given: `config.yaml.example` が(誤編集などで)`parseConfig` でエラーになる内容に
  変更されたPR / When: `ci.yml` が実行される
  Then: `tests/configExample.spec.ts`(spec 002)の失敗によりジョブが失敗し、
        マージ前に検知できる(spec 002の既知のギャップが解消されたことの実地確認)

## スコープ外(今回やらないこと)

- Lint / Formatterの導入(ESLint、Prettier等)
- テストカバレッジの計測・バッジ表示
- ブランチ保護ルールの実際の設定(GitHub UI上での「Require status checks to pass」等の
  手動操作)。手順をREADME.mdに記載することは要件に含めるが、設定操作自体は
  リポジトリ所有者が行う一度きりの手動作業とする
- リリース自動化(バージョニング、CHANGELOG生成、npm publish等)
- `daily.yml` の変更(既存ワークフローはそのまま維持する)
- 複数ジョブの同時実行を防ぐ `concurrency` 制御
- ワークフロー失敗時のSlack/メール等の通知連携(spec 002のスコープ外と同様の理由)

## 関連

- docs/DESIGN.md「GitHub Actions」
- `.github/workflows/daily.yml`
- specs/002-scheduled-run/spec.md(「PR時に `pnpm test` を自動実行するCIの追加」を既知の
  ギャップとしてスコープ外に明記していた箇所。本specの実装完了後に更新する)
- `.specify/memory/constitution.md`「I. 仕様駆動開発」(`[vitest]`/`[手動]`の区別の規約)

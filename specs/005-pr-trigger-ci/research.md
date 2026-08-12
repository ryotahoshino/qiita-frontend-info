# Research: PRトリガーでのCI整備

## 1. daily.ymlとのバージョン整合をvitestでどう検証するか

**Decision**: `yaml`パッケージ(既存依存、`src/config.ts`と同じ)で `.github/workflows/daily.yml` と
`.github/workflows/ci.yml` の両方をパースし、`jobs.<job>.steps[]` から `uses` が
`pnpm/action-setup@` で始まるステップの `with.version`、`uses` が `actions/setup-node@` で
始まるステップの `with.node-version` をそれぞれ抽出して比較する。

**Rationale**:
- 新規依存を増やさずに済む(`yaml`は既にdevで使われていないが`dependencies`に存在)
- ジョブ名やステップの並び順に依存せず、`uses`のprefixだけで対象ステップを特定できるため、
  将来ステップ順が変わっても壊れにくい
- 生YAMLの文字列比較(正規表現)より構造的で誤検知が少ない

**Alternatives considered**:
- 正規表現でYAMLテキストから直接`version:`/`node-version:`を抜き出す: 実装は簡単だが、
  コメント行や無関係な`version:`キーを誤って拾うリスクがある

## 2. シークレット不参照の検証方法

**Decision**: `ci.yml`のファイル内容(生テキスト)に文字列 `secrets.` が含まれないことを
assertする(YAML構造をパースして`env`ブロックを走査するのではなく、単純な文字列検索)。

**Rationale**:
- `secrets.QIITA_TOKEN`のような参照は`${{ secrets.X }}`という文字列としてYAML中に必ず現れるため、
  単純な文字列検索で十分かつ最も誤検知が少ない
- YAML構造走査(env/with/run全てを再帰的に見る)は複雑になる割に検出力が変わらない

**Alternatives considered**:
- YAMLをパースしてすべての値を再帰的に検査: 実装コストが高く、`run:`ブロック内のシェル文字列
  (マルチラインスクリプト)まで構造化されないため、結局文字列検索が必要になる

## 3. typecheckスクリプトの定義方法

**Decision**: `package.json`の`scripts.typecheck`に`"tsc --noEmit -p tsconfig.json"`を追加する。
`ci.yml`からは`pnpm run typecheck`を呼ぶ。

**Rationale**:
- ローカル開発者も`pnpm run typecheck`で同じコマンドを実行でき、CIとローカルの実行内容が
  一致する(daily.ymlが`pnpm run digest`という命名パターンを使っているのと一貫性がある)
- 既存の`tsconfig.json`(`include: ["src"]`)をそのまま使う。テストファイル(`tests/`)は
  型チェック対象外のまま(現状の運用を変えない)

**Alternatives considered**:
- `ci.yml`内に直接`npx tsc --noEmit -p tsconfig.json`を書く: package.jsonにコマンドが
  残らずローカルで再現しにくい

## 4. ci.ymlのジョブ構成

**Decision**: 単一ジョブ、`pnpm install --frozen-lockfile` の後に
`pnpm run typecheck` → `pnpm test` の順で実行する(daily.ymlと同じ「1ジョブ・逐次ステップ」の
シンプルな構成を踏襲)。

**Rationale**:
- どちらかが失敗すればGitHub Actionsのデフォルト挙動でジョブ全体が失敗(赤)になり、
  spec.mdの受け入れ条件(テスト失敗・型エラーいずれでもジョブが失敗する)を満たす
- 型チェックの方が高速に失敗を検知できることが多いため先に実行する
- 両方の失敗を同時に見たい場合は`continue-on-error`等の追加制御が要るが、本specのスコープ
  (「失敗したらジョブが赤くなる」)には不要と判断

**Alternatives considered**:
- typecheckとtestを別ジョブに分ける: 並列化できるが、`pnpm install`が2重になりCI時間・
  実装複雑度が増す。v0.1のプロジェクト規模では不要

## 5. Node/pnpmキャッシュ設定の一致方針

**Decision**: `pnpm/action-setup@v4`(`version: 9`)、`actions/setup-node@v4`
(`node-version: 22`、`cache: pnpm`)を`daily.yml`と同一の値で使う。これはユーザー要件
そのものであり、research上の未決事項はない。

## contracts/ を作成しない理由

本specはCI設定(ワークフローYAML)の追加であり、他システムやユーザーに公開する
API/CLIインターフェースを持たない(`plan-template.md`の「Skip if project is purely internal」
に該当)。データの形は`data-model.md`にワークフロー設定として記載する。

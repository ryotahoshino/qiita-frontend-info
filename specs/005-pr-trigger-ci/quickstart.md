# Quickstart: PRトリガーCIの検証

## 前提

- `pnpm install` 済み
- `.github/workflows/ci.yml` が実装済み(本specの実装フェーズ完了後)

## 1. vitestで検証できる部分(自動)

```powershell
pnpm test tests/workflowVersions.spec.ts tests/ciSecrets.spec.ts tests/typecheckScript.spec.ts
```

daily.ymlとのバージョン整合・シークレット不参照・`typecheck`スクリプト定義を確認する
(実際のファイル名はtasks生成時に決定する)。

## 2. 実際にPRを作成して確認する(手動、spec.mdの`[手動]`AC)

1. このブランチ(または適当な検証用ブランチ)から `main` 宛のPull Requestを作成する
2. PRのChecksタブに `ci.yml` のジョブが自動的に現れ、実行されることを確認する
3. 成功時: ジョブが緑になることを確認する
4. 失敗系の確認(任意、確認後は元に戻す):
   - 一時的にテストを失敗させるコード変更をpushし、ジョブが赤になることを確認する
   - 一時的に型エラーを含むコード変更をpushし、`typecheck`ステップで赤になることを確認する
   - 一時的に`config.yaml.example`を壊す変更をpushし、`tests/configExample.spec.ts`
     (spec 002)の失敗でジョブが赤になることを確認する(spec 002の既知のギャップが
     解消されたことの実地確認)
5. 確認用の変更はコミットを取り消すかPRをクローズし、`main`には取り込まない

## 3. mainへのpushトリガーの確認(手動)

PRをマージした際、マージコミットに対しても `ci.yml` が実行されることをActionsタブで確認する。

## 4. ブランチ保護ルール(手動、README記載の手順に従う)

`Settings > Branches > Branch protection rules` で `main` に対し
「Require status checks to pass before merging」を有効化し、`ci.yml` のジョブを必須チェックに
追加する(この設定操作自体はspec.mdのスコープ外だが、README記載の手順を実際に辿って
問題なく設定できることを確認する)。

# [###]: [FEATURE NAME]

- status: draft(← Claude Codeと壁打ちして固め、承認したら approved に変更)

<!--
  このプロジェクト(qiita-frontend-digest)のspec.mdは、GitHub Spec Kit標準のUser Story形式ではなく
  specs/001〜003で確立した独自フォーマットを使う(.specify/memory/constitution.md 参照)。
  「要件」「受け入れ条件(Given/When/Then)」「スコープ外」は必須セクション。
-->

## 目的(なぜ作るか)

[このspecで何を達成するか、なぜ今それが必要かを1〜2段落で説明する。既存の何が不足しているか、
docs/DESIGN.mdのどのロードマップ項目に対応するかを含める]

## 要件(何ができればよいか)

<!-- 何ができれば良いかを箇条書きで。実装コードではなく振る舞い・インターフェースの粒度で書く -->

- [要件1]
- [要件2]

## 受け入れ条件

<!--
  Given/When/Then形式で列挙する。各項目に検証方法を付記する:
  - `[vitest]` : 自動テストで検証できるもの(純粋関数・DIしたDigestDeps経由のパイプラインテスト等)
  - `[手動]`   : GitHub Actions実行など、vitestでは直接検証できず人手での実行確認が必要なもの
-->

- `[vitest]` Given: [前提] / When: [操作]
  Then: [期待される結果]

- `[手動]` Given: [前提] / When: [操作]
  Then: [期待される結果]

## スコープ外(今回やらないこと)

<!-- 意図的に対象外とする項目。関連する既存spec/将来specへの参照番号があれば併記する -->

- [スコープ外の項目1]

## 関連

- docs/DESIGN.md「[該当セクション]」
- [関連する既存 specs/NNN-*/spec.md]

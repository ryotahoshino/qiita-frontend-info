# Specification Quality Checklist: LLMありモード(オプトイン分類)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-25
**Feature**: [spec.md](../spec.md)

> 注記: 本プロジェクト(qiita-frontend-digest)の `spec.md` は GitHub Spec Kit 標準の
> ユーザーストーリー形式ではなく、`specs/001〜003` で確立し `.specify/memory/constitution.md`
> Principle I で明文化した独自フォーマット(目的/要件/受け入れ条件Given-When-Then/スコープ外/
> 関連)を使う。そのため「実装詳細を含まない」系の項目は、本プロジェクトの規約上は
> file paths / interface signatures を含めることが意図的な設計であり、Constitutionの
> 既存specとの整合を優先して「project convention」として扱う。

## Content Quality

- [x] No implementation details (languages, frameworks, APIs) — *project convention: 本プロジェクトのspec.mdはfile path/interfaceを含める規約(Constitution Principle I)*
- [x] Focused on user value and business needs — 目的セクションでDESIGN.mdロードマップとの対応を説明
- [x] Written for non-technical stakeholders — *project convention: 小規模OSSの技術spec形式(specs 001-003と同様)*
- [x] All mandatory sections completed — 目的/要件/受け入れ条件/スコープ外/関連すべて記載

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain — 未使用。曖昧だった3点は「前提とした判断」として明記した仮定に変換済み
- [x] Requirements are testable and unambiguous — 各要件が対応する受け入れ条件を持つ
- [x] Success criteria are measurable — 受け入れ条件はすべてGiven/When/Then形式
- [x] Success criteria are technology-agnostic (no implementation details) — *project convention*
- [x] All acceptance scenarios are defined — 6件(無効時/キー未設定/プロンプト内容/API失敗/不正応答/正常系)
- [ ] Edge cases are identified — API失敗・不正レスポンスはカバー済み。レート制限時の具体的な
      リトライ挙動等は「スコープ外」に明記して意図的に対象外とした(未解決の抜けではない)
- [x] Scope is clearly bounded — スコープ外セクションに4項目明記
- [x] Dependencies and assumptions identified — 「前提とした判断」セクションに3点明記

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows(有効/無効/キー未設定/API失敗/不正応答/正常系)
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification — *project convention*

## Notes

- 「前提とした判断」セクションの3点(LLMプロバイダ=Anthropic Claude API、置換方式、
  フォールバック方針)は人間のレビューで変更されうる。`/speckit-plan` に進む前に、または
  spec承認時にあわせて確認すること
- Edge Cases のレート制限リトライ挙動は明示的にスコープ外としたため未完了扱いにしていない

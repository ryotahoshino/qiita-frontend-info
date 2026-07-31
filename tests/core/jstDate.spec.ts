// specs/002-scheduled-run/spec.md の [vitest] 受け入れ条件を落としたもの:
// Given: UTC 22:00(= JST翌7:00)に相当する Date インスタンス / When: 日付フォーマット処理で日付文字列に変換する
// Then: JST基準の日付(UTC側の「当日」ではなく翌日)が返る
//
// formatJstDate は未実装(src/core/jstDate.ts)。toISOString()はUTC固定のため、
// これに依存した実装のままではこのテストは通らない。
import { describe, expect, it } from "vitest";
import { formatJstDate } from "../../src/core/jstDate.js";

describe("formatJstDate", () => {
  it("UTC 22:00(=JST翌7:00)はJST基準で翌日の日付になる", () => {
    // 2026-07-15T22:00:00Z = JSTでは2026-07-16 07:00
    const date = new Date("2026-07-15T22:00:00Z");
    expect(formatJstDate(date)).toBe("2026-07-16");
  });

  it("UTCとJSTで日付が変わらない時刻でも正しい日付を返す", () => {
    // 2026-07-15T00:00:00Z = JSTでは2026-07-15 09:00(UTC日付と同じ)
    const date = new Date("2026-07-15T00:00:00Z");
    expect(formatJstDate(date)).toBe("2026-07-15");
  });

  it("JST日付の23:59に近いUTC時刻でも日付が繰り上がらない", () => {
    // 2026-07-15T14:59:00Z = JSTでは2026-07-15 23:59
    const date = new Date("2026-07-15T14:59:00Z");
    expect(formatJstDate(date)).toBe("2026-07-15");
  });
});

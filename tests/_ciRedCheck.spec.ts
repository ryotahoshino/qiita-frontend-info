// 使い捨てブランチ chore/ci-red-check 専用。CIが実際に赤くなることを確認するための
// 意図的な失敗テスト。確認後、このファイルごとブランチを削除すること。
import { describe, expect, it } from "vitest";

describe("CI赤確認用(意図的な失敗)", () => {
  it("わざと失敗させる", () => {
    expect(1).toBe(2);
  });
});

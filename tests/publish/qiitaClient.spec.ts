import { afterEach, describe, expect, it, vi } from "vitest";
import { createQiitaPostFn } from "../../src/publish/qiitaClient.js";

describe("createQiitaPostFn", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Qiita API v2に正しいURL・ヘッダー・bodyでPOSTする", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 201, text: async () => "{}" }));
    vi.stubGlobal("fetch", fetchMock);

    const postToQiita = createQiitaPostFn({ token: "test-token", private: true });
    await postToQiita({ title: "タイトル", body: "本文", tags: ["frontend", "news"] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://qiita.com/api/v2/items");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer test-token",
      "Content-Type": "application/json",
    });
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      title: "タイトル",
      body: "本文",
      tags: [{ name: "frontend" }, { name: "news" }],
      private: true,
    });
  });

  it("private:falseを明示した場合はそのまま送信する(デフォルトはtrueのまま変更しない)", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 201, text: async () => "{}" }));
    vi.stubGlobal("fetch", fetchMock);

    const postToQiita = createQiitaPostFn({ token: "test-token", private: false });
    await postToQiita({ title: "t", body: "b", tags: [] });

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(init.body);
    expect(body.private).toBe(false);
  });

  it("レスポンスが失敗ステータスの場合はエラーを投げる", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 401, text: async () => "Unauthorized" })),
    );

    const postToQiita = createQiitaPostFn({ token: "bad-token", private: true });

    await expect(postToQiita({ title: "t", body: "b", tags: [] })).rejects.toThrow();
  });
});

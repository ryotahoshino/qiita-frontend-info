import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildArticlePath, readArticleFile, writeArticleFile } from "../../src/publish/filePublisher.js";

describe("buildArticlePath", () => {
  it("YYYY/MM/YYYY-MM-DD.md 形式のパスを組み立てる", () => {
    const path = buildArticlePath(new Date("2026-07-05T00:00:00Z"), "articles");
    expect(path).toBe(join("articles", "2026", "07", "2026-07-05.md"));
  });
});

describe("readArticleFile / writeArticleFile", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "qiita-digest-articles-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("ファイルが存在しない場合はnullを返す", async () => {
    const path = join(dir, "2026", "07", "2026-07-05.md");
    const content = await readArticleFile(path);
    expect(content).toBeNull();
  });

  it("writeArticleFileは中間ディレクトリを作成してから書き込み、readArticleFileで読み戻せる", async () => {
    const path = join(dir, "2026", "07", "2026-07-05.md");

    await writeArticleFile(path, "# hello\n");
    const content = await readArticleFile(path);

    expect(content).toBe("# hello\n");
    const raw = await readFile(path, "utf-8");
    expect(raw).toBe("# hello\n");
  });
});

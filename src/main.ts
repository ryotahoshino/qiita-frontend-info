import { runDigest } from "./digest.js";
import { appendErrorLog, buildErrorLogPath } from "./core/errorLog.js";
import { loadState, saveState } from "./core/state.js";
import { loadConfig } from "./config.js";
import { createRssCollector } from "./collectors/rssCollector.js";
import { buildArticlePath, readArticleFile, writeArticleFile } from "./publish/filePublisher.js";
import { createQiitaPostFn } from "./publish/qiitaClient.js";
import { appendArticles, renderArticles } from "./render/renderDigest.js";

async function main(): Promise<void> {
  const config = await loadConfig("config.yaml").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") {
      throw new Error("config.yaml が見つかりません。config.yaml.example をコピーして作成してください。");
    }
    throw error;
  });

  const today = new Date();
  const statePath = "state.json";
  const articlePath = buildArticlePath(today, "articles");
  const errorLogPath = buildErrorLogPath(today, "logs/errors");
  const qiitaToken = process.env.QIITA_TOKEN;

  const result = await runDigest({
    collectors: config.feeds.map((feed) => createRssCollector(feed)),
    today,
    qiitaToken,
    tags: config.qiita.tags,
    loadState: () => loadState(statePath),
    saveState: (state) => saveState(statePath, state),
    readArticleFile: () => readArticleFile(articlePath),
    writeArticleFile: (content) => writeArticleFile(articlePath, content),
    renderArticles,
    appendArticles,
    postToQiita: createQiitaPostFn({ token: qiitaToken ?? "", private: config.qiita.private }),
    logError: (entry) => appendErrorLog(errorLogPath, entry),
  });

  process.exitCode = result.exitCode;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

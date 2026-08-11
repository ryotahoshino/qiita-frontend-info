import { readFile } from "node:fs/promises";
import { runDigest } from "./digest.js";
import { createAnthropicClassifier } from "./core/anthropicClassifier.js";
import { appendErrorLog, buildErrorLogPath } from "./core/errorLog.js";
import { appendSkippedLog, buildSkippedLogPath } from "./core/skippedLog.js";
import { createKeywordClassifier, parseTopics } from "./core/topicMatcher.js";
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
  const topicsMarkdown = await readFile("TOPICS.md", "utf-8");
  const topics = parseTopics(topicsMarkdown);

  const today = new Date();
  const statePath = "state.json";
  const articlePath = buildArticlePath(today, "articles");
  const errorLogPath = buildErrorLogPath(today, "logs/errors");
  const skippedLogPath = buildSkippedLogPath(today, "logs/skipped");
  const qiitaToken = process.env.QIITA_TOKEN;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const logError = (entry: Parameters<typeof appendErrorLog>[1]) => appendErrorLog(errorLogPath, entry);

  // llm.enabled かつ ANTHROPIC_API_KEY が設定されている場合のみLLM分類を使う。
  // いずれか欠けている場合はキーワードマッチのみで動作する(CLAUDE.md「LLMはオプトイン」原則)。
  const keywordClassifier = createKeywordClassifier();
  const classifier =
    config.llm.enabled && anthropicApiKey
      ? createAnthropicClassifier({ apiKey: anthropicApiKey, fallback: keywordClassifier, logError })
      : keywordClassifier;

  const result = await runDigest({
    collectors: config.feeds.map((feed) => createRssCollector(feed)),
    today,
    qiitaToken,
    tags: config.qiita.tags,
    topics,
    topicsMarkdown,
    classifier,
    loadState: () => loadState(statePath),
    saveState: (state) => saveState(statePath, state),
    readArticleFile: () => readArticleFile(articlePath),
    writeArticleFile: (content) => writeArticleFile(articlePath, content),
    renderArticles,
    appendArticles,
    postToQiita: createQiitaPostFn({ token: qiitaToken ?? "", private: config.qiita.private }),
    logError,
    logSkipped: (entry) => appendSkippedLog(skippedLogPath, entry),
  });

  process.exitCode = result.exitCode;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
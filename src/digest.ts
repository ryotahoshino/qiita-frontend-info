import type { Collector, NewsItem } from "./collectors/types.js";
import { formatJstDate } from "./core/jstDate.js";
import { normalizeUrl } from "./core/normalizeUrl.js";
import type { Classifier } from "./core/classifier.js";
import type { Topic, TopicSection } from "./core/topicMatcher.js";
import type { ErrorLogEntry } from "./core/errorLog.js";
import type { SkippedLogEntry } from "./core/skippedLog.js";
import type { StateFile } from "./core/state.js";
import type { QiitaPostPayload } from "./publish/qiitaClient.js";

export interface DigestDeps {
  collectors: Collector[];
  today: Date;
  qiitaToken: string | undefined;
  tags?: string[];
  topics: Topic[];
  topicsMarkdown: string;
  classifier: Classifier;
  loadState(): Promise<StateFile | null>;
  saveState(state: StateFile): Promise<void>;
  readArticleFile(): Promise<string | null>;
  writeArticleFile(content: string): Promise<void>;
  renderArticles(sections: TopicSection[], today: Date): string;
  appendArticles(existingContent: string, sections: TopicSection[]): string;
  postToQiita(payload: QiitaPostPayload): Promise<void>;
  logError(entry: ErrorLogEntry): Promise<void>;
  logSkipped(entry: SkippedLogEntry): Promise<void>;
}

export interface DigestResult {
  exitCode: number;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function reportError(deps: DigestDeps, entry: ErrorLogEntry): Promise<void> {
  console.error(`[${entry.phase}] ${entry.errorType}: ${entry.message}`);
  await deps.logError(entry);
}

async function collectItems(deps: DigestDeps): Promise<NewsItem[]> {
  const items: NewsItem[] = [];
  for (const collector of deps.collectors) {
    try {
      items.push(...(await collector.fetch()));
    } catch (error) {
      await reportError(deps, {
        phase: "collect",
        errorType: "collector_fetch_failed",
        message: describeError(error),
        source: collector.name,
      });
    }
  }
  return items;
}

// 1件のURLが不正でも(例: <link>欠落)、他の正常な記事の処理を止めない。
async function selectNewItems(
  deps: DigestDeps,
  items: NewsItem[],
  seenUrls: Set<string>,
): Promise<{ items: NewsItem[]; normalizedUrls: string[] }> {
  const newItems: NewsItem[] = [];
  const normalizedUrls: string[] = [];

  for (const item of items) {
    let normalized: string;
    try {
      normalized = normalizeUrl(item.url);
    } catch (error) {
      await reportError(deps, {
        phase: "collect",
        errorType: "invalid_item_url",
        message: describeError(error),
        source: item.source,
      });
      continue;
    }

    if (!seenUrls.has(normalized)) {
      newItems.push(item);
      normalizedUrls.push(normalized);
    }
  }

  return { items: newItems, normalizedUrls };
}

// deps.classifier(キーワードマッチ or LLM)でバッチ分類する。skipされた記事はlogSkippedに
// 記録し、それ以外はtopics宣言順にグループ化する。
async function classifyItems(
  deps: DigestDeps,
  items: NewsItem[],
): Promise<{ sections: TopicSection[]; skippedCount: number }> {
  const classifications = await deps.classifier.classify(items, deps.topics, deps.topicsMarkdown);
  const itemsByTopic = new Map<string, NewsItem[]>();
  let skippedCount = 0;

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!;
    const { topic, relevance } = classifications[i]!;
    if (relevance === "skip") {
      skippedCount += 1;
      await deps.logSkipped({
        title: item.title,
        url: item.url,
        source: item.source,
        publishedAt: item.publishedAt.toISOString(),
      });
      continue;
    }

    const bucket = itemsByTopic.get(topic) ?? [];
    bucket.push(item);
    itemsByTopic.set(topic, bucket);
  }

  const sections: TopicSection[] = [];
  for (const topic of deps.topics) {
    const bucket = itemsByTopic.get(topic.name);
    if (bucket && bucket.length > 0) {
      sections.push({ topic: topic.name, items: bucket });
    }
  }

  return { sections, skippedCount };
}

export async function runDigest(deps: DigestDeps): Promise<DigestResult> {
  const items = await collectItems(deps);

  const state = (await deps.loadState()) ?? { seenUrls: [] };
  const seenUrls = new Set(state.seenUrls.map(normalizeUrl));
  const { items: newItems, normalizedUrls } = await selectNewItems(deps, items, seenUrls);

  if (newItems.length === 0) {
    return { exitCode: 0 };
  }

  const { sections } = await classifyItems(deps, newItems);

  const mergedSeenUrls = Array.from(new Set([...state.seenUrls, ...normalizedUrls]));

  if (sections.length === 0) {
    await deps.saveState({ seenUrls: mergedSeenUrls });
    return { exitCode: 0 };
  }

  const existingContent = await deps.readArticleFile();
  const isRerun = existingContent !== null;
  const content = isRerun
    ? deps.appendArticles(existingContent, sections)
    : deps.renderArticles(sections, deps.today);

  await deps.writeArticleFile(content);
  await deps.saveState({ seenUrls: mergedSeenUrls });

  if (isRerun) {
    return { exitCode: 0 };
  }

  if (!deps.qiitaToken) {
    console.error("QIITA_TOKEN is not set. Skipping Qiita post.");
    return { exitCode: 0 };
  }

  try {
    await deps.postToQiita({
      title: `フロントエンド最新ニュース ${formatJstDate(deps.today)}`,
      body: content,
      tags: deps.tags ?? ["frontend", "news"],
    });
  } catch (error) {
    await reportError(deps, {
      phase: "publish",
      errorType: "qiita_post_failed",
      message: describeError(error),
    });
  }

  return { exitCode: 0 };
}
import type { Collector, NewsItem } from "../collectors/types.js";
import { appendArticles, renderArticles } from "../render/renderDigest.js";
import { normalizeUrl } from "./normalizeUrl.js";

export interface StateFile {
  seenUrls: string[];
}

export interface QiitaPostPayload {
  title: string;
  body: string;
  tags: string[];
}

export interface ErrorLogEntry {
  phase: "collect" | "publish";
  errorType: string;
  message: string;
  source?: string;
}

export interface DigestDeps {
  collectors: Collector[];
  today: Date;
  qiitaToken: string | undefined;
  tags?: string[];
  loadState(): Promise<StateFile | null>;
  saveState(state: StateFile): Promise<void>;
  readArticleFile(): Promise<string | null>;
  writeArticleFile(content: string): Promise<void>;
  postToQiita(payload: QiitaPostPayload): Promise<void>;
  logError(entry: ErrorLogEntry): Promise<void>;
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

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
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

export async function runDigest(deps: DigestDeps): Promise<DigestResult> {
  const items = await collectItems(deps);

  const state = (await deps.loadState()) ?? { seenUrls: [] };
  const seenUrls = new Set(state.seenUrls.map(normalizeUrl));
  const newItems = items.filter((item) => !seenUrls.has(normalizeUrl(item.url)));

  if (newItems.length === 0) {
    return { exitCode: 0 };
  }

  const existingContent = await deps.readArticleFile();
  const isRerun = existingContent !== null;
  const content = isRerun
    ? appendArticles(existingContent, newItems)
    : renderArticles(newItems, deps.today);

  await deps.writeArticleFile(content);

  const mergedSeenUrls = Array.from(
    new Set([...state.seenUrls, ...newItems.map((item) => normalizeUrl(item.url))]),
  );
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
      title: `フロントエンド最新ニュース ${formatDate(deps.today)}`,
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

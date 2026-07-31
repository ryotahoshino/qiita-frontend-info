import { XMLParser } from "fast-xml-parser";
import type { Collector, NewsItem } from "./types.js";

const parser = new XMLParser({ ignoreAttributes: false });

export interface RssFeedConfig {
  name: string;
  url: string;
}

export function parseRssItems(xml: string, source: string): NewsItem[] {
  const doc = parser.parse(xml);
  const rawItems = doc?.rss?.channel?.item ?? [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];
  return items.map((item) => toNewsItem(item, source));
}

function toNewsItem(item: Record<string, unknown>, source: string): NewsItem {
  const summary = item.description !== undefined ? String(item.description).trim() : undefined;
  return {
    title: String(item.title ?? "").trim(),
    url: String(item.link ?? "").trim(),
    publishedAt: new Date(String(item.pubDate ?? "")),
    source,
    ...(summary !== undefined ? { summary } : {}),
  };
}

export function createRssCollector(feed: RssFeedConfig): Collector {
  return {
    name: feed.name,
    async fetch(): Promise<NewsItem[]> {
      const response = await fetch(feed.url);
      if (!response.ok) {
        throw new Error(`RSSフィード取得に失敗しました: ${feed.url} (status: ${response.status})`);
      }
      const xml = await response.text();
      return parseRssItems(xml, feed.name);
    },
  };
}

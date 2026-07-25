import type { NewsItem } from "../collectors/types.js";

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function renderItemLine(item: NewsItem): string {
  return `- [${item.title}](${item.url}) — ${formatDate(item.publishedAt)}`;
}

export function renderArticles(items: NewsItem[], date: Date): string {
  const lines = items.map(renderItemLine);
  return `# ${formatDate(date)} フロントエンド最新ニュース\n\n${lines.join("\n")}\n`;
}

export function appendArticles(existingContent: string, items: NewsItem[]): string {
  const lines = items.map(renderItemLine);
  const separator = existingContent.endsWith("\n") ? "" : "\n";
  return `${existingContent}${separator}${lines.join("\n")}\n`;
}

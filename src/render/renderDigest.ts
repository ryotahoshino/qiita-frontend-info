import type { NewsItem } from "../collectors/types.js";
import type { TopicSection } from "../core/topicMatcher.js";
import { formatJstDate } from "../core/jstDate.js";

function renderItemLine(item: NewsItem): string {
  return `- [${item.title}](${item.url}) — ${formatJstDate(item.publishedAt)}`;
}

function renderSection(section: TopicSection): string {
  const lines = section.items.map(renderItemLine);
  return `## ${section.topic}\n\n${lines.join("\n")}`;
}

export function renderArticles(sections: TopicSection[], date: Date): string {
  const body = sections.map(renderSection).join("\n\n");
  return `# ${formatJstDate(date)} フロントエンド最新ニュース\n\n${body}\n`;
}

export function appendArticles(existingContent: string, sections: TopicSection[]): string {
  const body = sections.map(renderSection).join("\n\n");
  const separator = existingContent.endsWith("\n\n") ? "" : existingContent.endsWith("\n") ? "\n" : "\n\n";
  return `${existingContent}${separator}${body}\n`;
}
import type { NewsItem } from "../collectors/types.js";
import type { Classifier } from "./classifier.js";

export interface Topic {
  name: string;
  priority: "high" | "medium";
  keywords: string[];
}

export interface TopicSection {
  topic: string;
  items: NewsItem[];
}

export interface Classification {
  topic: string;
  relevance: "high" | "medium" | "skip";
}

// keywords: 行を持たない見出し(例: ## 除外条件)はトピックとして扱わない。
export function parseTopics(markdown: string): Topic[] {
  const topics: Topic[] = [];
  const sections = markdown.split(/^## /m).slice(1);

  for (const section of sections) {
    const [headingLine = "", ...rest] = section.split("\n");
    const body = rest.join("\n");

    const priorityMatch = body.match(/^- priority:\s*(high|medium)\s*$/m);
    const keywordsMatch = body.match(/^- keywords:\s*(.+)$/m);
    if (!priorityMatch || !keywordsMatch) {
      continue;
    }

    const keywords = keywordsMatch[1]!
      .split(",")
      .map((keyword) => keyword.trim())
      .filter((keyword) => keyword.length > 0);

    topics.push({
      name: headingLine.trim(),
      priority: priorityMatch[1] as "high" | "medium",
      keywords,
    });
  }

  return topics;
}

// title と summary を対象に、topics の宣言順でkeywordsを大文字小文字を無視した部分一致で検査する。
// 最初に一致したトピックを採用し、どれにも一致しなければ skip を返す。
export function classify(item: NewsItem, topics: Topic[]): Classification {
  const haystack = `${item.title} ${item.summary ?? ""}`.toLowerCase();

  for (const topic of topics) {
    const matched = topic.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
    if (matched) {
      return { topic: topic.name, relevance: topic.priority };
    }
  }

  return { topic: "", relevance: "skip" };
}

// 既存の classify() を Classifier インターフェースとして提供する(contracts/classifier-interface.md)。
// topicsMarkdown は使用しない(キーワードマッチはパース済みの topics のみで完結するため)。
export function createKeywordClassifier(): Classifier {
  return {
    name: "keyword",
    async classify(items: NewsItem[], topics: Topic[]): Promise<Classification[]> {
      return items.map((item) => classify(item, topics));
    },
  };
}
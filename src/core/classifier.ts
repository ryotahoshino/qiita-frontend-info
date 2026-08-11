import type { NewsItem } from "../collectors/types.js";
import type { Classification, Topic } from "./topicMatcher.js";

// classify() の戻り値は items と同じ順序・同じ長さで対応する(classifications[i] は items[i] の結果)。
// 実装は例外を投げず、常に妥当な Classification[] を返す(contracts/classifier-interface.md)。
export interface Classifier {
  name: string;
  classify(items: NewsItem[], topics: Topic[], topicsMarkdown: string): Promise<Classification[]>;
}

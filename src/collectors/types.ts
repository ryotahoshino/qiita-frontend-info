export interface NewsItem {
  title: string;
  url: string;
  publishedAt: Date;
  source: string;
  summary?: string;
}

export interface Collector {
  name: string;
  fetch(): Promise<NewsItem[]>;
}

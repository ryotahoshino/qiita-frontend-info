import { readFile } from "node:fs/promises";
import { parse } from "yaml";

export interface FeedConfig {
  name: string;
  url: string;
}

export interface GithubReleaseConfig {
  owner: string;
  repo: string;
}

export interface QiitaConfig {
  private: boolean;
  tags: string[];
}

export interface LlmConfig {
  enabled: boolean;
}

export interface Config {
  feeds: FeedConfig[];
  github_releases: GithubReleaseConfig[];
  qiita: QiitaConfig;
  llm: LlmConfig;
}

export function parseConfig(yamlText: string): Config {
  const raw = (parse(yamlText) ?? {}) as Record<string, unknown>;
  const qiita = (raw.qiita ?? {}) as Partial<QiitaConfig>;
  const llm = (raw.llm ?? {}) as Partial<LlmConfig>;

  return {
    feeds: (raw.feeds as FeedConfig[] | undefined) ?? [],
    github_releases: (raw.github_releases as GithubReleaseConfig[] | undefined) ?? [],
    qiita: {
      // private のデフォルトは true 固定。false にするのは config.yaml 側の明示的な設定のみ。
      private: qiita.private ?? true,
      tags: qiita.tags ?? ["frontend", "news"],
    },
    llm: {
      enabled: llm.enabled ?? false,
    },
  };
}

export async function loadConfig(filePath: string): Promise<Config> {
  const text = await readFile(filePath, "utf-8");
  return parseConfig(text);
}

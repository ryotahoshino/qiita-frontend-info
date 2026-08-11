import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { formatJstDate } from "./jstDate.js";

export interface SkippedLogEntry {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
}

export function buildSkippedLogPath(date: Date, baseDir: string): string {
  return join(baseDir, `${formatJstDate(date)}.json`);
}

async function readEntries(filePath: string): Promise<unknown[]> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as unknown[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function appendSkippedLog(filePath: string, entry: SkippedLogEntry): Promise<void> {
  const entries = await readEntries(filePath);
  entries.push(entry);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(entries, null, 2)}\n`, "utf-8");
}
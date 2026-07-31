import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ErrorLogEntry } from "./digest.js";

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildErrorLogPath(date: Date, baseDir: string): string {
  return join(baseDir, `${formatDate(date)}.json`);
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

export async function appendErrorLog(filePath: string, entry: ErrorLogEntry): Promise<void> {
  const entries = await readEntries(filePath);
  entries.push({ timestamp: new Date().toISOString(), ...entry });
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(entries, null, 2)}\n`, "utf-8");
}

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildArticlePath(date: Date, baseDir: string): string {
  const [year, month] = formatDate(date).split("-");
  return join(baseDir, year!, month!, `${formatDate(date)}.md`);
}

export async function readArticleFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function writeArticleFile(filePath: string, content: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
}

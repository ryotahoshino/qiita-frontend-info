import { readFile, writeFile } from "node:fs/promises";

export interface StateFile {
  seenUrls: string[];
}

export async function loadState(filePath: string): Promise<StateFile | null> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as StateFile;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function saveState(filePath: string, state: StateFile): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
}

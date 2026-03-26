import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";

/**
 * Writes a file only if the content differs from what's already on disk.
 * Returns true if the file was written, false if skipped (unchanged).
 */
export async function writeFileIfChanged(
  filePath: string,
  content: string
): Promise<boolean> {
  if (existsSync(filePath)) {
    const existing = await readFile(filePath, "utf-8");
    if (existing === content) {
      return false;
    }
  }
  await writeFile(filePath, content);
  return true;
}

import { getAllFolders } from '../../indexing/vector-store.js';

export async function handleListFolders(
  dbPath: string
): Promise<{ folders: Array<{ name: string; document_count: number }> }> {
  const folders = await getAllFolders(dbPath);
  return { folders };
}

import { getAllDocuments } from '../../indexing/vector-store.js';

export async function handleListDocuments(
  dbPath: string,
  params: { folder?: string; limit?: number }
): Promise<{
  documents: Array<{
    id: string;
    title: string;
    folders: string[];
    date: string;
    summary: string;
    has_transcript: boolean;
  }>;
  total_count: number;
}> {
  const { folder, limit = 20 } = params;

  const allDocs = await getAllDocuments(dbPath, { folder });

  const documents = allDocs.slice(0, limit).map(doc => ({
    id: doc.id,
    title: doc.title,
    folders: doc.folders,
    date: doc.created_at.split('T')[0],
    summary: doc.insights_summary,
    has_transcript: doc.has_transcript,
  }));

  return {
    documents,
    total_count: allDocs.length,
  };
}

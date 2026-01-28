import { getDocumentById } from '../../indexing/vector-store.js';
import type { Speaker } from '../../types.js';

export async function handleGetDocument(
  dbPath: string,
  params: { document_id: string }
): Promise<{
  id: string;
  title: string;
  folders: string[];
  created_at: string;
  insights_summary: string;
  granola_summary: string;
  themes: Array<{
    name: string;
    description: string;
    evidence: Array<{ text: string; speaker: Speaker }>;
  }>;
  key_quotes: Array<{
    text: string;
    speaker: Speaker;
    timestamp?: string;
    context: string;
    theme?: string;
  }>;
  has_transcript: boolean;
} | { error: string }> {
  const doc = await getDocumentById(dbPath, params.document_id);

  if (!doc) {
    return { error: `Document not found: ${params.document_id}` };
  }

  return {
    id: doc.id,
    title: doc.title,
    folders: doc.folders,
    created_at: doc.created_at,
    insights_summary: doc.insights_summary,
    granola_summary: doc.granola_summary,
    themes: doc.themes,
    key_quotes: doc.key_quotes,
    has_transcript: doc.has_transcript,
  };
}

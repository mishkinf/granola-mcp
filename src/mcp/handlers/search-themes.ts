import { getAllDocuments, getDocumentById } from '../../indexing/vector-store.js';
import { getThemeById } from '../../indexing/themes.js';
import type { ThemeSearchResult } from '../../types.js';

export async function handleSearchThemes(
  dbPath: string,
  params: { theme: string; folder?: string; limit?: number }
): Promise<ThemeSearchResult> {
  const { theme, folder, limit = 10 } = params;

  // Get theme definition
  const themeDefinition = getThemeById(theme);
  if (!themeDefinition) {
    return {
      theme,
      documents: [],
      total_evidence_count: 0,
    };
  }

  // Get all documents
  const allDocs = await getAllDocuments(dbPath, { folder });

  // Filter to documents with this theme and get full details
  const matchingDocs: ThemeSearchResult['documents'] = [];
  let totalEvidence = 0;

  for (const doc of allDocs.slice(0, limit * 2)) {
    const fullDoc = await getDocumentById(dbPath, doc.id);
    if (!fullDoc) continue;

    const themeData = fullDoc.themes.find(t => t.name === theme);
    if (!themeData) continue;

    // Get quotes related to this theme
    const themeQuotes = fullDoc.key_quotes.filter(q => q.theme === theme);

    matchingDocs.push({
      id: fullDoc.id,
      title: fullDoc.title,
      folders: fullDoc.folders,
      date: fullDoc.created_at.split('T')[0],
      evidence: themeData.evidence,
      key_quotes: themeQuotes,
    });

    totalEvidence += themeData.evidence.length;

    if (matchingDocs.length >= limit) break;
  }

  return {
    theme,
    documents: matchingDocs,
    total_evidence_count: totalEvidence,
  };
}

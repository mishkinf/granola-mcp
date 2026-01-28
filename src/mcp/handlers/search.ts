import { generateEmbedding } from '../../indexing/embedder.js';
import { searchDocuments, getThemeStats } from '../../indexing/vector-store.js';
import type { SearchResponse, Quote } from '../../types.js';

export async function handleSearch(
  dbPath: string,
  params: { query: string; folder?: string; limit?: number }
): Promise<SearchResponse> {
  const { query, folder, limit = 5 } = params;

  // Generate embedding for query
  const queryVector = await generateEmbedding(query);

  // Search documents
  const results = await searchDocuments(dbPath, queryVector, { limit, folder });

  // Get theme stats for context
  const themeStats = await getThemeStats(dbPath);

  // Build response
  const searchResults = results.map(doc => {
    // Find quotes most relevant to the query
    const relevantQuotes = doc.key_quotes.slice(0, 3);

    return {
      document: {
        id: doc.id,
        title: doc.title,
        folders: doc.folders,
        date: doc.created_at.split('T')[0],
      },
      relevance_score: Math.round(doc.score * 100) / 100,
      summary: doc.insights_summary,
      matching_themes: doc.themes.map(t => t.name),
      key_quotes: relevantQuotes,
      full_transcript_available: doc.has_transcript,
      total_quotes_available: doc.key_quotes.length,
    };
  });

  // Aggregate theme stats for found documents
  const themesFound: Record<string, { document_count: number; total_quotes: number }> = {};
  for (const result of results) {
    for (const theme of result.themes) {
      if (!themesFound[theme.name]) {
        const stats = themeStats.get(theme.name);
        themesFound[theme.name] = stats || { document_count: 0, total_quotes: 0 };
      }
    }
  }

  return {
    query,
    results: searchResults,
    themes_found: themesFound,
  };
}

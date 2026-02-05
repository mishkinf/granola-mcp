export { THEMES, getThemeById, getThemeNames, getThemePromptList } from './themes.js';
export { extractInsights, extractInsightsBatch } from './insight-extractor.js';
export { generateEmbedding, generateEmbeddings, createSearchableText, getEmbeddingDimensions } from './embedder.js';
export {
  getDatabase,
  closeDatabase,
  indexExists,
  initializeTables,
  storeDocuments,
  storeChunks,
  searchDocuments,
  searchChunks,
  getAllDocuments,
  getDocumentById,
  getThemeStats,
  getAllFolders,
  getIndexedDocumentIds,
} from './vector-store.js';

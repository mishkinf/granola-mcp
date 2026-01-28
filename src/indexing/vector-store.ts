import * as lancedb from '@lancedb/lancedb';
import * as arrow from 'apache-arrow';
import type { IndexedDocument, ChunkRecord, DocumentRecord, Quote, Theme } from '../types.js';
import { getEmbeddingDimensions } from './embedder.js';
import { existsSync } from 'fs';
import path from 'path';

let db: lancedb.Connection | null = null;

export async function getDatabase(dbPath: string): Promise<lancedb.Connection> {
  if (!db) {
    db = await lancedb.connect(dbPath);
  }
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    db = null;
  }
}

const DOCUMENTS_TABLE = 'documents';
const CHUNKS_TABLE = 'chunks';

// Check if index exists
export async function indexExists(dbPath: string): Promise<boolean> {
  if (!existsSync(dbPath)) return false;
  try {
    const database = await getDatabase(dbPath);
    const tables = await database.tableNames();
    return tables.includes(DOCUMENTS_TABLE) && tables.includes(CHUNKS_TABLE);
  } catch {
    return false;
  }
}

// Initialize or recreate tables
export async function initializeTables(dbPath: string): Promise<void> {
  const database = await getDatabase(dbPath);
  const existingTables = await database.tableNames();

  // Drop existing tables if they exist
  if (existingTables.includes(DOCUMENTS_TABLE)) {
    await database.dropTable(DOCUMENTS_TABLE);
  }
  if (existingTables.includes(CHUNKS_TABLE)) {
    await database.dropTable(CHUNKS_TABLE);
  }
}

// Store indexed documents
export async function storeDocuments(
  dbPath: string,
  documents: Array<{
    doc: IndexedDocument;
    summaryVector: number[];
  }>
): Promise<void> {
  const database = await getDatabase(dbPath);

  const records = documents.map(({ doc, summaryVector }) => ({
    id: doc.id,
    title: doc.title,
    folders: JSON.stringify(doc.folders),
    created_at: doc.created_at,
    insights_summary: doc.insights_summary,
    granola_summary: doc.granola_summary,
    themes_json: JSON.stringify(doc.themes),
    key_quotes_json: JSON.stringify(doc.key_quotes),
    has_transcript: doc.has_transcript,
    vector: summaryVector,
  }));

  // Create or overwrite table
  await database.createTable(DOCUMENTS_TABLE, records, { mode: 'overwrite' });
}

// Store chunks for detailed search
export async function storeChunks(
  dbPath: string,
  chunks: ChunkRecord[]
): Promise<void> {
  const database = await getDatabase(dbPath);

  const records = chunks.map(chunk => ({
    id: chunk.id,
    document_id: chunk.document_id,
    content: chunk.content,
    type: chunk.type,
    theme_name: chunk.theme_name || '',
    timestamp: chunk.timestamp || '',
    vector: chunk.vector,
  }));

  // Create or overwrite table
  await database.createTable(CHUNKS_TABLE, records, { mode: 'overwrite' });
}

// Search documents by semantic similarity
export async function searchDocuments(
  dbPath: string,
  queryVector: number[],
  options: {
    limit?: number;
    folder?: string;
  } = {}
): Promise<Array<{
  id: string;
  title: string;
  folders: string[];
  created_at: string;
  insights_summary: string;
  granola_summary: string;
  themes: Theme[];
  key_quotes: Quote[];
  has_transcript: boolean;
  score: number;
}>> {
  const { limit = 10, folder } = options;
  const database = await getDatabase(dbPath);

  try {
    const table = await database.openTable(DOCUMENTS_TABLE);
    let query = table.search(queryVector).limit(limit);

    const results = await query.toArray();

    return results
      .filter(row => {
        if (!folder) return true;
        const folders = JSON.parse(row.folders as string) as string[];
        return folders.some(f => f.toLowerCase().includes(folder.toLowerCase()));
      })
      .map(row => ({
        id: row.id as string,
        title: row.title as string,
        folders: JSON.parse(row.folders as string) as string[],
        created_at: row.created_at as string,
        insights_summary: row.insights_summary as string,
        granola_summary: row.granola_summary as string,
        themes: JSON.parse(row.themes_json as string) as Theme[],
        key_quotes: JSON.parse(row.key_quotes_json as string) as Quote[],
        has_transcript: row.has_transcript as boolean,
        // Convert L2 distance to similarity (0-1 range): 1/(1+distance)
        score: row._distance !== undefined ? 1 / (1 + (row._distance as number)) : 0,
      }));
  } catch (error) {
    console.error('Error searching documents:', error);
    return [];
  }
}

// Search chunks for fine-grained results
export async function searchChunks(
  dbPath: string,
  queryVector: number[],
  options: {
    limit?: number;
    type?: ChunkRecord['type'];
    themeName?: string;
  } = {}
): Promise<Array<{
  id: string;
  document_id: string;
  content: string;
  type: string;
  theme_name: string;
  timestamp: string;
  score: number;
}>> {
  const { limit = 20, type, themeName } = options;
  const database = await getDatabase(dbPath);

  try {
    const table = await database.openTable(CHUNKS_TABLE);
    let query = table.search(queryVector).limit(limit * 2); // Over-fetch for filtering

    const results = await query.toArray();

    return results
      .filter(row => {
        if (type && row.type !== type) return false;
        if (themeName && row.theme_name !== themeName) return false;
        return true;
      })
      .slice(0, limit)
      .map(row => ({
        id: row.id as string,
        document_id: row.document_id as string,
        content: row.content as string,
        type: row.type as string,
        theme_name: row.theme_name as string,
        timestamp: row.timestamp as string,
        // Convert L2 distance to similarity (0-1 range): 1/(1+distance)
        score: row._distance !== undefined ? 1 / (1 + (row._distance as number)) : 0,
      }));
  } catch (error) {
    console.error('Error searching chunks:', error);
    return [];
  }
}

// Get all documents (for listing)
export async function getAllDocuments(
  dbPath: string,
  options: {
    folder?: string;
  } = {}
): Promise<Array<{
  id: string;
  title: string;
  folders: string[];
  created_at: string;
  insights_summary: string;
  has_transcript: boolean;
}>> {
  const { folder } = options;
  const database = await getDatabase(dbPath);

  try {
    const table = await database.openTable(DOCUMENTS_TABLE);
    const results = await table.query().toArray();

    return results
      .filter(row => {
        if (!folder) return true;
        const folders = JSON.parse(row.folders as string) as string[];
        return folders.some(f => f.toLowerCase().includes(folder.toLowerCase()));
      })
      .map(row => ({
        id: row.id as string,
        title: row.title as string,
        folders: JSON.parse(row.folders as string) as string[],
        created_at: row.created_at as string,
        insights_summary: row.insights_summary as string,
        has_transcript: row.has_transcript as boolean,
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch (error) {
    console.error('Error getting all documents:', error);
    return [];
  }
}

// Get document by ID
export async function getDocumentById(
  dbPath: string,
  documentId: string
): Promise<{
  id: string;
  title: string;
  folders: string[];
  created_at: string;
  insights_summary: string;
  granola_summary: string;
  themes: Theme[];
  key_quotes: Quote[];
  has_transcript: boolean;
} | null> {
  const database = await getDatabase(dbPath);

  try {
    const table = await database.openTable(DOCUMENTS_TABLE);
    const results = await table.query().where(`id = '${documentId}'`).toArray();

    if (results.length === 0) return null;

    const row = results[0];
    return {
      id: row.id as string,
      title: row.title as string,
      folders: JSON.parse(row.folders as string) as string[],
      created_at: row.created_at as string,
      insights_summary: row.insights_summary as string,
      granola_summary: row.granola_summary as string,
      themes: JSON.parse(row.themes_json as string) as Theme[],
      key_quotes: JSON.parse(row.key_quotes_json as string) as Quote[],
      has_transcript: row.has_transcript as boolean,
    };
  } catch (error) {
    console.error('Error getting document by ID:', error);
    return null;
  }
}

// Get theme statistics
export async function getThemeStats(
  dbPath: string
): Promise<Map<string, { document_count: number; total_quotes: number }>> {
  const database = await getDatabase(dbPath);
  const stats = new Map<string, { document_count: number; total_quotes: number }>();

  try {
    const table = await database.openTable(DOCUMENTS_TABLE);
    const results = await table.query().toArray();

    for (const row of results) {
      const themes = JSON.parse(row.themes_json as string) as Theme[];
      for (const theme of themes) {
        const existing = stats.get(theme.name) || { document_count: 0, total_quotes: 0 };
        existing.document_count++;
        existing.total_quotes += theme.evidence.length;
        stats.set(theme.name, existing);
      }
    }
  } catch (error) {
    console.error('Error getting theme stats:', error);
  }

  return stats;
}

// Get all unique folders
export async function getAllFolders(
  dbPath: string
): Promise<Array<{ name: string; document_count: number }>> {
  const database = await getDatabase(dbPath);
  const folderCounts = new Map<string, number>();

  try {
    const table = await database.openTable(DOCUMENTS_TABLE);
    const results = await table.query().toArray();

    for (const row of results) {
      const folders = JSON.parse(row.folders as string) as string[];
      for (const folder of folders) {
        folderCounts.set(folder, (folderCounts.get(folder) || 0) + 1);
      }
    }
  } catch (error) {
    console.error('Error getting folders:', error);
  }

  return Array.from(folderCounts.entries())
    .map(([name, document_count]) => ({ name, document_count }))
    .sort((a, b) => b.document_count - a.document_count);
}

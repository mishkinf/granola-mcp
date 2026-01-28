import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { getDocumentById, getAllDocuments } from '../../indexing/vector-store.js';

export async function handleGetTranscript(
  dbPath: string,
  exportDir: string,
  params: { document_id: string }
): Promise<{ document_id: string; title: string; transcript: string } | { error: string }> {
  // Get document info
  const doc = await getDocumentById(dbPath, params.document_id);
  if (!doc) {
    return { error: `Document not found: ${params.document_id}` };
  }

  // Find the transcript file
  // First, list all directories in export folder and find matching one
  const allDocs = await getAllDocuments(dbPath);
  const targetDoc = allDocs.find(d => d.id === params.document_id);

  if (!targetDoc) {
    return { error: `Document not found: ${params.document_id}` };
  }

  // Try to find transcript by looking for document directories
  // The directory name is sanitized from the title
  const sanitizedTitle = sanitizeFilename(doc.title);
  const transcriptPath = path.join(exportDir, sanitizedTitle, 'transcript.txt');

  if (!existsSync(transcriptPath)) {
    // Try markdown version
    const mdPath = path.join(exportDir, sanitizedTitle, 'transcript.md');
    if (existsSync(mdPath)) {
      const transcript = await readFile(mdPath, 'utf-8');
      return {
        document_id: params.document_id,
        title: doc.title,
        transcript,
      };
    }

    return {
      error: `Transcript not available for: ${doc.title}`,
    };
  }

  const transcript = await readFile(transcriptPath, 'utf-8');
  return {
    document_id: params.document_id,
    title: doc.title,
    transcript,
  };
}

// Match the sanitization in the export command
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 100);
}

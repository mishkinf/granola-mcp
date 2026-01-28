import { z } from 'zod';

// Tool schemas using Zod for validation
export const searchSchema = z.object({
  query: z.string().describe('Semantic search query for finding relevant meeting insights'),
  folder: z.string().optional().describe('Filter results to a specific folder'),
  limit: z.number().optional().default(5).describe('Maximum number of results to return'),
});

export const searchThemesSchema = z.object({
  theme: z.string().describe('Theme to search for (e.g., "pain-points", "feature-requests", "pricing")'),
  folder: z.string().optional().describe('Filter results to a specific folder'),
  limit: z.number().optional().default(10).describe('Maximum number of documents to return'),
});

export const listFoldersSchema = z.object({});

export const listDocumentsSchema = z.object({
  folder: z.string().optional().describe('Filter to documents in this folder'),
  limit: z.number().optional().default(20).describe('Maximum number of documents to return'),
});

export const getDocumentSchema = z.object({
  document_id: z.string().describe('The document ID to retrieve'),
});

export const getTranscriptSchema = z.object({
  document_id: z.string().describe('The document ID to get transcript for'),
});

export const getThemesSchema = z.object({});

// Tool definitions for MCP
export const toolDefinitions = [
  {
    name: 'search',
    description: `Semantic search across meeting insights. Returns document summaries with relevant quotes - NOT raw transcripts.

Use this to find meetings related to a topic, question, or concept. Results include:
- Document summary and key insights
- Matching themes
- Relevant quotes with timestamps and SPEAKER ATTRIBUTION
- Option to get full transcript if needed

SPEAKER ATTRIBUTION:
- speaker: "me" = The meeting host (the person whose data this is)
- speaker: "participant" = Other people in the meeting (interviewees, colleagues, experts)

This is important for distinguishing the host's own ideas from external feedback/insights.

Example queries:
- "What did users say about pricing?"
- "Pain points with the current workflow"
- "Feature requests from customer interviews"`,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Semantic search query for finding relevant meeting insights' },
        folder: { type: 'string', description: 'Filter results to a specific folder' },
        limit: { type: 'number', description: 'Maximum number of results to return (default: 5)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_themes',
    description: `Find documents by theme with supporting evidence.

Available themes:
- pain-points: User frustrations, problems, complaints
- feature-requests: Desired features, wishlist items
- positive-feedback: What users liked, praised, found valuable
- pricing: Cost concerns, value perception
- competition: Mentions of competitors, alternatives
- workflow: How users currently do things, workarounds
- decisions: Key decisions made, action items, next steps
- questions: Open questions, things needing clarification

Returns documents matching the theme with specific evidence quotes.

SPEAKER ATTRIBUTION:
Each quote includes speaker: "me" (the host) or "participant" (others).
This helps distinguish the host's statements from external feedback.`,
    inputSchema: {
      type: 'object',
      properties: {
        theme: { type: 'string', description: 'Theme to search for' },
        folder: { type: 'string', description: 'Filter results to a specific folder' },
        limit: { type: 'number', description: 'Maximum number of documents to return (default: 10)' },
      },
      required: ['theme'],
    },
  },
  {
    name: 'list_folders',
    description: 'List all folders containing meeting documents with document counts.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'list_documents',
    description: 'List documents with brief summaries. Optionally filter by folder.',
    inputSchema: {
      type: 'object',
      properties: {
        folder: { type: 'string', description: 'Filter to documents in this folder' },
        limit: { type: 'number', description: 'Maximum number of documents to return (default: 20)' },
      },
      required: [],
    },
  },
  {
    name: 'get_document',
    description: 'Get full details for a specific document including all themes, quotes, and summaries.',
    inputSchema: {
      type: 'object',
      properties: {
        document_id: { type: 'string', description: 'The document ID to retrieve' },
      },
      required: ['document_id'],
    },
  },
  {
    name: 'get_transcript',
    description: `Get the full raw transcript for a document. Use sparingly - prefer search results which include relevant excerpts.

Only use this when you need:
- Complete chronological context
- Specific quotes not found in search results
- Full conversation flow`,
    inputSchema: {
      type: 'object',
      properties: {
        document_id: { type: 'string', description: 'The document ID to get transcript for' },
      },
      required: ['document_id'],
    },
  },
  {
    name: 'get_themes',
    description: 'List all available themes with their definitions and document counts.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

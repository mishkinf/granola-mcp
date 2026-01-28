#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import path from 'path';

import { toolDefinitions } from './tools.js';
import { handleSearch } from './handlers/search.js';
import { handleSearchThemes } from './handlers/search-themes.js';
import { handleGetDocument } from './handlers/get-document.js';
import { handleGetTranscript } from './handlers/get-transcript.js';
import { handleListFolders } from './handlers/list-folders.js';
import { handleListDocuments } from './handlers/list-documents.js';
import { handleGetThemes } from './handlers/get-themes.js';
import { indexExists } from '../indexing/vector-store.js';

// Configuration from environment
const GRANOLA_DATA_DIR = process.env.GRANOLA_DATA_DIR || './export';
const DB_PATH = path.join(GRANOLA_DATA_DIR, 'vectors.lance');

async function main() {
  // Check if index exists
  const hasIndex = await indexExists(DB_PATH);
  if (!hasIndex) {
    console.error(`Warning: No index found at ${DB_PATH}. Run 'granola-extract index' first.`);
  }

  const server = new Server(
    {
      name: 'granola-meetings',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: toolDefinitions };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: unknown;

      switch (name) {
        case 'search':
          result = await handleSearch(DB_PATH, args as { query: string; folder?: string; limit?: number });
          break;

        case 'search_themes':
          result = await handleSearchThemes(DB_PATH, args as { theme: string; folder?: string; limit?: number });
          break;

        case 'list_folders':
          result = await handleListFolders(DB_PATH);
          break;

        case 'list_documents':
          result = await handleListDocuments(DB_PATH, args as { folder?: string; limit?: number });
          break;

        case 'get_document':
          result = await handleGetDocument(DB_PATH, args as { document_id: string });
          break;

        case 'get_transcript':
          result = await handleGetTranscript(DB_PATH, GRANOLA_DATA_DIR, args as { document_id: string });
          break;

        case 'get_themes':
          result = await handleGetThemes(DB_PATH);
          break;

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: errorMessage }),
          },
        ],
        isError: true,
      };
    }
  });

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});

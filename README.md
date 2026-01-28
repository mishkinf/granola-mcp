# Granola Extractor

CLI tool to extract Granola meeting notes, build a semantic search index, and expose it via MCP for AI assistants.

Based on reverse engineering research by [Joseph Thacker](https://josephthacker.com/hacking/2025/05/08/reverse-engineering-granola-notes.html) and [getprobo](https://github.com/getprobo/reverse-engineering-granola-api).

## Features

- **Export**: Extract all your Granola meetings with transcripts
- **Semantic Search**: Vector-indexed search across meetings with pre-extracted insights
- **Speaker Attribution**: Distinguishes between host (`me`) and participants
- **Theme Extraction**: Auto-categorizes content into themes (pain-points, feature-requests, etc.)
- **MCP Server**: Exposes search to Claude Code, Claude Desktop, and other AI tools

## Prerequisites

- Node.js 18+
- Granola desktop app installed and logged in
- OpenAI API key (for embeddings and insight extraction)

## Installation

```bash
npm install
npm run build
```

## Quick Start

```bash
# 1. Export meetings from Granola
node dist/index.js export ./export

# 2. Build the search index (extracts insights + creates embeddings)
OPENAI_API_KEY=sk-... node dist/index.js index ./export

# 3. Test search
OPENAI_API_KEY=sk-... node dist/index.js search "user pain points"
```

## CLI Commands

### Export from Granola

```bash
node dist/index.js export ./output
node dist/index.js export ./output --format markdown
node dist/index.js export ./output --format json
```

### Build Search Index

```bash
# Full indexing with insight extraction (~$0.02/document)
OPENAI_API_KEY=sk-... node dist/index.js index ./export

# Skip extraction (use existing insights, just rebuild embeddings)
OPENAI_API_KEY=sk-... node dist/index.js index ./export --skip-extraction
```

### Search from CLI

```bash
OPENAI_API_KEY=sk-... node dist/index.js search "pricing concerns"
OPENAI_API_KEY=sk-... node dist/index.js search "feature requests" --folder "User interviews"
```

### Export for ChatGPT

```bash
OPENAI_API_KEY=sk-... node dist/index.js export-combined ./chatgpt.md
OPENAI_API_KEY=sk-... node dist/index.js export-combined ./chatgpt.md --query "user feedback"
```

### Other Commands

```bash
node dist/index.js list              # List documents
node dist/index.js workspaces        # List workspaces
node dist/index.js folders           # List folders
node dist/index.js transcript <id>   # Get specific transcript
```

## MCP Server Setup

### Claude Code

Add to `.mcp.json` in your project:

```json
{
  "mcpServers": {
    "granola": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/granola-extractor/dist/mcp/server.js"],
      "env": {
        "GRANOLA_DATA_DIR": "/path/to/granola-extractor/export",
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "granola": {
      "command": "node",
      "args": ["/path/to/granola-extractor/dist/mcp/server.js"],
      "env": {
        "GRANOLA_DATA_DIR": "/path/to/granola-extractor/export",
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `search` | Semantic search across meetings, returns summaries + quotes |
| `search_themes` | Find documents by theme (pain-points, feature-requests, etc.) |
| `list_folders` | List all folders with document counts |
| `list_documents` | List documents with brief summaries |
| `get_document` | Get full document details (all themes + quotes) |
| `get_transcript` | Get raw transcript (use sparingly) |
| `get_themes` | List available themes with definitions |

## Speaker Attribution

The system distinguishes between speakers:
- `speaker: "me"` - The meeting host (you)
- `speaker: "participant"` - Other people in the meeting

This helps AI understand what's your own idea vs external feedback.

## Pre-defined Themes

- **pain-points**: User frustrations, problems, complaints
- **feature-requests**: Desired features, wishlist items
- **positive-feedback**: What users liked, praised
- **pricing**: Cost concerns, value perception
- **competition**: Competitor mentions, alternatives
- **workflow**: How users currently do things
- **decisions**: Key decisions made, action items
- **questions**: Open questions needing clarification

## Output Structure

```
export/
├── vectors.lance/           # LanceDB vector index
├── Meeting_Title_1/
│   ├── document.json        # Raw document data
│   ├── notes.md             # Converted notes
│   ├── transcript.json      # Raw transcript with speaker info
│   ├── transcript.md        # Formatted transcript
│   └── transcript.txt       # Plain text transcript
└── Meeting_Title_2/
    └── ...
```

## How It Works

1. **Export**: Reads credentials from `~/Library/Application Support/Granola/supabase.json` and fetches all documents via Granola's API

2. **Index**:
   - Extracts themes and key quotes using GPT-4o-mini
   - Generates embeddings using text-embedding-3-small
   - Stores in LanceDB for fast vector search

3. **Search**:
   - Embeds your query
   - Finds semantically similar documents
   - Returns summaries + relevant quotes (not raw transcripts)

## Cost Estimates

| Documents | Insight Extraction | Embeddings | Total |
|-----------|-------------------|------------|-------|
| 25 | ~$0.50 | ~$0.01 | ~$0.51 |
| 100 | ~$2.00 | ~$0.02 | ~$2.02 |
| 500 | ~$10.00 | ~$0.10 | ~$10.10 |

Search queries are free (vector similarity, no LLM calls).

## License

MIT

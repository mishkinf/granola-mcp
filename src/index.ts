#!/usr/bin/env node

import { Command } from "commander";
import { mkdir, writeFile, readFile, readdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { loadAccessToken } from "./credentials.js";
import {
  getAllDocuments,
  getDocumentTranscript,
  getWorkspaces,
  getDocumentLists,
  type GranolaDocument,
  type TranscriptUtterance,
  type Workspace,
  type DocumentList,
} from "./api.js";
import {
  proseMirrorToMarkdown,
  transcriptToMarkdown,
  transcriptToPlainText,
  transcriptWithSpeakers,
} from "./converter.js";
import {
  extractInsights,
  generateEmbedding,
  generateEmbeddings,
  createSearchableText,
  initializeTables,
  storeDocuments,
  storeChunks,
  searchDocuments,
  getAllDocuments as getAllIndexedDocuments,
  getThemeStats,
  THEMES,
} from "./indexing/index.js";
import type { IndexedDocument, ChunkRecord, Quote, Theme } from "./types.js";

const program = new Command();

program
  .name("granola-extract")
  .description("Extract Granola meeting notes and transcripts")
  .version("1.0.0");

program
  .command("export")
  .description("Export all Granola documents to a directory")
  .argument("<output-dir>", "Output directory for exported files")
  .option("--include-transcripts", "Include raw transcripts", true)
  .option("--format <format>", "Output format: markdown, json, or both", "both")
  .option("--raw-only", "Export only raw JSON data without conversion")
  .action(async (outputDir: string, options) => {
    try {
      console.log("Loading credentials...");
      const token = await loadAccessToken();

      console.log("Fetching documents...");
      const documents = await getAllDocuments(token);
      console.log(`Found ${documents.length} documents`);

      console.log("Fetching workspaces...");
      const workspaces = await getWorkspaces(token);
      const workspaceMap = new Map(workspaces.map((w) => [w.id, w.name]));

      console.log("Fetching folders...");
      const folders = await getDocumentLists(token);

      // Create output directory
      await mkdir(outputDir, { recursive: true });

      // Save metadata files
      await writeFile(
        join(outputDir, "workspaces.json"),
        JSON.stringify(workspaces, null, 2)
      );
      await writeFile(
        join(outputDir, "folders.json"),
        JSON.stringify(folders, null, 2)
      );

      // Process each document
      let processed = 0;
      for (const doc of documents) {
        const docDir = join(outputDir, sanitizeFilename(doc.title || doc.id));
        await mkdir(docDir, { recursive: true });

        // Save raw document JSON
        await writeFile(
          join(docDir, "document.json"),
          JSON.stringify(doc, null, 2)
        );

        // Fetch and save transcript
        let transcript: TranscriptUtterance[] | null = null;
        if (options.includeTranscripts) {
          transcript = await getDocumentTranscript(token, doc.id);
          if (transcript) {
            await writeFile(
              join(docDir, "transcript.json"),
              JSON.stringify(transcript, null, 2)
            );
          }
        }

        // Convert and save if not raw-only
        if (!options.rawOnly) {
          const format = options.format;

          if (format === "markdown" || format === "both") {
            // Save notes as markdown
            const notesMarkdown = createNotesMarkdown(
              doc,
              workspaceMap,
              folders
            );
            await writeFile(join(docDir, "notes.md"), notesMarkdown);

            // Save transcript as markdown
            if (transcript) {
              const transcriptMd = transcriptToMarkdown(transcript);
              await writeFile(join(docDir, "transcript.md"), transcriptMd);

              // Save plain text transcript
              const plainText = transcriptToPlainText(transcript);
              await writeFile(join(docDir, "transcript.txt"), plainText);
            }
          }
        }

        processed++;
        process.stdout.write(`\rProcessed ${processed}/${documents.length}`);
      }

      console.log("\n\nExport complete!");
      console.log(`Output directory: ${outputDir}`);
    } catch (error) {
      console.error("Error:", (error as Error).message);
      process.exit(1);
    }
  });

program
  .command("list")
  .description("List all Granola documents")
  .option("--json", "Output as JSON")
  .action(async (options) => {
    try {
      const token = await loadAccessToken();
      const documents = await getAllDocuments(token);

      if (options.json) {
        console.log(JSON.stringify(documents, null, 2));
      } else {
        console.log(`Found ${documents.length} documents:\n`);
        for (const doc of documents) {
          const date = new Date(doc.created_at).toLocaleDateString();
          console.log(`- [${date}] ${doc.title || "Untitled"} (${doc.id})`);
        }
      }
    } catch (error) {
      console.error("Error:", (error as Error).message);
      process.exit(1);
    }
  });

program
  .command("transcript")
  .description("Get transcript for a specific document")
  .argument("<document-id>", "Document ID")
  .option("--format <format>", "Output format: json, markdown, or text", "text")
  .action(async (documentId: string, options) => {
    try {
      const token = await loadAccessToken();
      const transcript = await getDocumentTranscript(token, documentId);

      if (!transcript) {
        console.log("No transcript found for this document.");
        return;
      }

      switch (options.format) {
        case "json":
          console.log(JSON.stringify(transcript, null, 2));
          break;
        case "markdown":
          console.log(transcriptToMarkdown(transcript));
          break;
        case "text":
        default:
          console.log(transcriptToPlainText(transcript));
      }
    } catch (error) {
      console.error("Error:", (error as Error).message);
      process.exit(1);
    }
  });

program
  .command("workspaces")
  .description("List all workspaces")
  .action(async () => {
    try {
      const token = await loadAccessToken();
      const workspaces = await getWorkspaces(token);

      console.log(`Found ${workspaces.length} workspaces:\n`);
      for (const ws of workspaces) {
        console.log(`- ${ws.name} (${ws.id})`);
      }
    } catch (error) {
      console.error("Error:", (error as Error).message);
      process.exit(1);
    }
  });

program
  .command("folders")
  .description("List all folders")
  .action(async () => {
    try {
      const token = await loadAccessToken();
      const folders = await getDocumentLists(token);

      console.log(`Found ${folders.length} folders:\n`);
      for (const folder of folders) {
        const name = folder.title || folder.name || "Untitled";
        const docCount =
          folder.documents?.length || folder.document_ids?.length || 0;
        console.log(`- ${name} (${docCount} documents) [${folder.id}]`);
      }
    } catch (error) {
      console.error("Error:", (error as Error).message);
      process.exit(1);
    }
  });

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 100);
}

function createNotesMarkdown(
  doc: GranolaDocument,
  workspaceMap: Map<string, string>,
  folders: DocumentList[]
): string {
  const frontmatter = [
    "---",
    `granola_id: ${doc.id}`,
    `title: "${(doc.title || "Untitled").replace(/"/g, '\\"')}"`,
    `created_at: ${doc.created_at}`,
    `updated_at: ${doc.updated_at}`,
  ];

  if (doc.workspace_id) {
    frontmatter.push(`workspace_id: ${doc.workspace_id}`);
    const workspaceName = workspaceMap.get(doc.workspace_id);
    if (workspaceName) {
      frontmatter.push(`workspace_name: "${workspaceName}"`);
    }
  }

  // Find folders containing this document
  const docFolders = folders.filter(
    (f) =>
      f.document_ids?.includes(doc.id) ||
      f.documents?.some((d) => d.id === doc.id)
  );
  if (docFolders.length > 0) {
    const folderNames = docFolders.map((f) => f.title || f.name || "Untitled");
    frontmatter.push(`folders: [${folderNames.map((n) => `"${n}"`).join(", ")}]`);
  }

  frontmatter.push("---\n");

  const content = proseMirrorToMarkdown(doc.last_viewed_panel?.content);

  return frontmatter.join("\n") + "\n" + content;
}

// INDEX COMMAND - Build vector index with insight extraction
program
  .command("index")
  .description("Build vector index from exported Granola data with AI insight extraction")
  .argument("<export-dir>", "Directory containing exported Granola data")
  .option("--model <model>", "OpenAI model for insight extraction", "gpt-4o-mini")
  .option("--skip-extraction", "Skip insight extraction (use existing or empty insights)")
  .action(async (exportDir: string, options) => {
    try {
      if (!process.env.OPENAI_API_KEY) {
        console.error("Error: OPENAI_API_KEY environment variable is required");
        process.exit(1);
      }

      const dbPath = join(exportDir, "vectors.lance");
      console.log(`Building index in ${dbPath}...`);

      // Find all document directories
      const entries = await readdir(exportDir, { withFileTypes: true });
      const docDirs = entries.filter(
        (e) => e.isDirectory() && !e.name.endsWith(".lance")
      );

      console.log(`Found ${docDirs.length} document directories`);

      // Load and process each document
      const indexedDocs: Array<{ doc: IndexedDocument; summaryVector: number[] }> = [];
      const allChunks: ChunkRecord[] = [];

      let processed = 0;
      for (const dir of docDirs) {
        const docPath = join(exportDir, dir.name, "document.json");
        const notesPath = join(exportDir, dir.name, "notes.md");
        const transcriptPath = join(exportDir, dir.name, "transcript.txt");

        if (!existsSync(docPath)) continue;

        // Load document data
        const docJson = JSON.parse(await readFile(docPath, "utf-8")) as GranolaDocument;

        // Load notes
        let notes = "";
        if (existsSync(notesPath)) {
          const notesContent = await readFile(notesPath, "utf-8");
          // Remove frontmatter
          notes = notesContent.replace(/^---[\s\S]*?---\n*/, "");
        }

        // Load transcript with speaker attribution
        let transcript = "";
        const transcriptJsonPath = join(exportDir, dir.name, "transcript.json");
        const hasTranscript = existsSync(transcriptJsonPath) || existsSync(transcriptPath);
        if (existsSync(transcriptJsonPath)) {
          // Use JSON transcript for speaker attribution
          const transcriptJson = JSON.parse(await readFile(transcriptJsonPath, "utf-8")) as TranscriptUtterance[];
          if (transcriptJson && transcriptJson.length > 0) {
            transcript = transcriptWithSpeakers(transcriptJson);
          }
        } else if (existsSync(transcriptPath)) {
          // Fallback to plain text (no speaker info)
          transcript = await readFile(transcriptPath, "utf-8");
        }

        // Extract folders from notes frontmatter
        const folders: string[] = [];
        if (existsSync(notesPath)) {
          const notesContent = await readFile(notesPath, "utf-8");
          const folderMatch = notesContent.match(/folders:\s*\[(.*?)\]/);
          if (folderMatch) {
            const folderStr = folderMatch[1];
            const folderMatches = folderStr.match(/"([^"]+)"/g);
            if (folderMatches) {
              folders.push(...folderMatches.map((f) => f.replace(/"/g, "")));
            }
          }
        }

        // Extract insights
        let insights = {
          insights_summary: notes.substring(0, 500) || "No summary available",
          themes: [] as Theme[],
          key_quotes: [] as Quote[],
        };

        if (!options.skipExtraction && (transcript || notes)) {
          console.log(`\nExtracting insights for: ${docJson.title || dir.name}`);
          insights = await extractInsights(
            transcript,
            notes,
            docJson.title || dir.name,
            options.model
          );
        }

        // Create indexed document
        const indexedDoc: IndexedDocument = {
          id: docJson.id,
          title: docJson.title || dir.name,
          folders,
          created_at: docJson.created_at,
          updated_at: docJson.updated_at,
          granola_summary: notes,
          themes: insights.themes,
          key_quotes: insights.key_quotes,
          insights_summary: insights.insights_summary,
          has_transcript: hasTranscript,
        };

        // Generate embedding for summary
        const summaryText = createSearchableText({
          type: "summary",
          text: insights.insights_summary,
        });
        const summaryVector = await generateEmbedding(summaryText);

        indexedDocs.push({ doc: indexedDoc, summaryVector });

        // Create chunks for detailed search
        // Chunk for insights summary
        allChunks.push({
          id: `${docJson.id}_summary`,
          document_id: docJson.id,
          content: insights.insights_summary,
          type: "summary",
          vector: summaryVector,
        });

        // Chunks for themes
        for (const theme of insights.themes) {
          // Format evidence with speaker attribution
          const evidenceTexts = theme.evidence.map(e =>
            `[${e.speaker === 'me' ? 'ME' : 'PARTICIPANT'}] ${e.text}`
          );
          const themeText = createSearchableText({
            type: "theme",
            text: `${theme.description}. Evidence: ${evidenceTexts.join(" | ")}`,
            theme_name: theme.name,
          });
          const themeVector = await generateEmbedding(themeText);
          allChunks.push({
            id: `${docJson.id}_theme_${theme.name}`,
            document_id: docJson.id,
            content: theme.description,
            type: "theme",
            theme_name: theme.name,
            vector: themeVector,
          });
        }

        // Chunks for key quotes
        for (let i = 0; i < insights.key_quotes.length; i++) {
          const quote = insights.key_quotes[i];
          const quoteText = createSearchableText({
            type: "quote",
            text: quote.text,
            context: quote.context,
          });
          const quoteVector = await generateEmbedding(quoteText);
          allChunks.push({
            id: `${docJson.id}_quote_${i}`,
            document_id: docJson.id,
            content: quote.text,
            type: "quote",
            theme_name: quote.theme,
            timestamp: quote.timestamp,
            vector: quoteVector,
          });
        }

        processed++;
        process.stdout.write(`\rProcessed ${processed}/${docDirs.length}`);
      }

      console.log("\n\nStoring in vector database...");

      // Initialize tables
      await initializeTables(dbPath);

      // Store documents and chunks
      await storeDocuments(dbPath, indexedDocs);
      await storeChunks(dbPath, allChunks);

      console.log(`\nIndexing complete!`);
      console.log(`- Documents indexed: ${indexedDocs.length}`);
      console.log(`- Chunks created: ${allChunks.length}`);
      console.log(`- Database: ${dbPath}`);
    } catch (error) {
      console.error("Error:", (error as Error).message);
      process.exit(1);
    }
  });

// SEARCH COMMAND - Test semantic search from CLI
program
  .command("search")
  .description("Search indexed Granola data semantically")
  .argument("<query>", "Search query")
  .option("--folder <folder>", "Filter to a specific folder")
  .option("--limit <limit>", "Maximum results", "5")
  .option("--export-dir <dir>", "Export directory with index", "./export")
  .action(async (query: string, options) => {
    try {
      if (!process.env.OPENAI_API_KEY) {
        console.error("Error: OPENAI_API_KEY environment variable is required");
        process.exit(1);
      }

      const dbPath = join(options.exportDir, "vectors.lance");
      if (!existsSync(dbPath)) {
        console.error(`Error: No index found at ${dbPath}. Run 'index' command first.`);
        process.exit(1);
      }

      console.log(`Searching for: "${query}"\n`);

      // Generate query embedding
      const queryVector = await generateEmbedding(query);

      // Search documents
      const results = await searchDocuments(dbPath, queryVector, {
        limit: parseInt(options.limit),
        folder: options.folder,
      });

      if (results.length === 0) {
        console.log("No results found.");
        return;
      }

      // Display results
      for (const doc of results) {
        console.log("─".repeat(60));
        console.log(`📄 ${doc.title}`);
        console.log(`   Date: ${doc.created_at.split("T")[0]}`);
        console.log(`   Folders: ${doc.folders.join(", ") || "None"}`);
        console.log(`   Relevance: ${Math.round(doc.score * 100)}%`);
        console.log(`\n   Summary: ${doc.insights_summary}`);

        if (doc.themes.length > 0) {
          console.log(`\n   Themes: ${doc.themes.map((t) => t.name).join(", ")}`);
        }

        if (doc.key_quotes.length > 0) {
          console.log("\n   Key Quotes:");
          for (const quote of doc.key_quotes.slice(0, 3)) {
            const ts = quote.timestamp ? ` [${quote.timestamp}]` : "";
            console.log(`   • "${quote.text}"${ts}`);
          }
        }
        console.log();
      }
    } catch (error) {
      console.error("Error:", (error as Error).message);
      process.exit(1);
    }
  });

// EXPORT-COMBINED COMMAND - Export for ChatGPT
program
  .command("export-combined")
  .description("Export meeting insights to a combined Markdown file for ChatGPT")
  .argument("<output-file>", "Output Markdown file path")
  .option("--export-dir <dir>", "Export directory with index", "./export")
  .option("--query <query>", "Filter to documents matching this query")
  .option("--folder <folder>", "Filter to a specific folder")
  .option("--include-full-notes", "Include full Granola notes (not just insights)")
  .action(async (outputFile: string, options) => {
    try {
      const dbPath = join(options.exportDir, "vectors.lance");
      if (!existsSync(dbPath)) {
        console.error(`Error: No index found at ${dbPath}. Run 'index' command first.`);
        process.exit(1);
      }

      let documents = await getAllIndexedDocuments(dbPath, { folder: options.folder });

      // Filter by query if provided
      if (options.query && process.env.OPENAI_API_KEY) {
        const queryVector = await generateEmbedding(options.query);
        const results = await searchDocuments(dbPath, queryVector, { limit: 50 });
        const matchingIds = new Set(results.map((r) => r.id));
        documents = documents.filter((d) => matchingIds.has(d.id));
      }

      console.log(`Exporting ${documents.length} documents...`);

      // Build Markdown content
      const lines: string[] = [
        "# Meeting Insights Export",
        "",
        `Generated: ${new Date().toISOString().split("T")[0]}`,
        `Documents: ${documents.length}`,
        "",
      ];

      // Theme summary
      const themeStats = await getThemeStats(dbPath);
      if (themeStats.size > 0) {
        lines.push("## Themes Overview", "");
        for (const [theme, stats] of themeStats) {
          const themeDef = THEMES.find((t) => t.id === theme);
          lines.push(
            `- **${themeDef?.name || theme}**: ${stats.document_count} documents, ${stats.total_quotes} evidence items`
          );
        }
        lines.push("");
      }

      lines.push("## Documents", "");

      // Document entries
      for (const doc of documents) {
        lines.push(`### ${doc.title}`, "");
        lines.push(`**Date:** ${doc.created_at.split("T")[0]}`);
        if (doc.folders.length > 0) {
          lines.push(`**Folders:** ${doc.folders.join(", ")}`);
        }
        lines.push("");

        lines.push("**Summary:**", doc.insights_summary, "");

        lines.push("---", "");
      }

      await writeFile(outputFile, lines.join("\n"));
      console.log(`\nExported to: ${outputFile}`);
    } catch (error) {
      console.error("Error:", (error as Error).message);
      process.exit(1);
    }
  });

// SYNC COMMAND - Export from Granola and rebuild index in one step
program
  .command("sync")
  .description("Sync with Granola: export latest data and rebuild search index")
  .argument("[data-dir]", "Directory for Granola data", "./export")
  .option("--model <model>", "OpenAI model for insight extraction", "gpt-4o-mini")
  .option("--skip-extraction", "Skip insight extraction (faster, uses existing insights)")
  .action(async (dataDir: string, options) => {
    try {
      console.log("=== STEP 1: Export from Granola ===\n");

      // Check for OpenAI key first
      if (!process.env.OPENAI_API_KEY) {
        console.error("Error: OPENAI_API_KEY environment variable is required");
        console.error("Set it with: export OPENAI_API_KEY=sk-...");
        process.exit(1);
      }

      // Export phase
      console.log("Loading credentials...");
      const token = await loadAccessToken();

      console.log("Fetching documents...");
      const documents = await getAllDocuments(token);
      console.log(`Found ${documents.length} documents`);

      console.log("Fetching workspaces...");
      const workspaces = await getWorkspaces(token);

      console.log("Fetching folders...");
      const folders = await getDocumentLists(token);

      // Create output directory
      await mkdir(dataDir, { recursive: true });

      // Save metadata files
      await writeFile(
        join(dataDir, "workspaces.json"),
        JSON.stringify(workspaces, null, 2)
      );
      await writeFile(
        join(dataDir, "folders.json"),
        JSON.stringify(folders, null, 2)
      );

      const workspaceMap = new Map(workspaces.map((w) => [w.id, w.name]));

      // Process each document
      let exported = 0;
      for (const doc of documents) {
        const docDir = join(dataDir, sanitizeFilename(doc.title || doc.id));
        await mkdir(docDir, { recursive: true });

        // Save raw document JSON
        await writeFile(
          join(docDir, "document.json"),
          JSON.stringify(doc, null, 2)
        );

        // Fetch and save transcript
        const transcript = await getDocumentTranscript(token, doc.id);
        if (transcript) {
          await writeFile(
            join(docDir, "transcript.json"),
            JSON.stringify(transcript, null, 2)
          );
          await writeFile(
            join(docDir, "transcript.md"),
            transcriptToMarkdown(transcript)
          );
          await writeFile(
            join(docDir, "transcript.txt"),
            transcriptToPlainText(transcript)
          );
        }

        // Convert and save notes
        const notesMarkdown = createNotesMarkdown(doc, workspaceMap, folders);
        await writeFile(join(docDir, "notes.md"), notesMarkdown);

        exported++;
        process.stdout.write(`\rExported ${exported}/${documents.length} documents`);
      }
      console.log("\n");

      // Index phase
      console.log("=== STEP 2: Build Search Index ===\n");

      const dbPath = join(dataDir, "vectors.lance");
      console.log(`Building index in ${dbPath}...`);

      // Initialize tables
      await initializeTables(dbPath);

      // Read exported documents
      const docDirs = (await readdir(dataDir, { withFileTypes: true }))
        .filter((d) => d.isDirectory() && !d.name.endsWith(".lance"));

      console.log(`Found ${docDirs.length} document directories`);

      const indexedDocs: Array<{ doc: IndexedDocument; summaryVector: number[] }> = [];
      const allChunks: ChunkRecord[] = [];

      let processed = 0;
      for (const dir of docDirs) {
        const docPath = join(dataDir, dir.name, "document.json");
        const notesPath = join(dataDir, dir.name, "notes.md");
        const transcriptJsonPath = join(dataDir, dir.name, "transcript.json");
        const transcriptPath = join(dataDir, dir.name, "transcript.txt");

        if (!existsSync(docPath)) continue;

        // Load document data
        const docJson = JSON.parse(await readFile(docPath, "utf-8")) as GranolaDocument;

        // Load notes
        let notes = "";
        if (existsSync(notesPath)) {
          const notesContent = await readFile(notesPath, "utf-8");
          notes = notesContent.replace(/^---[\s\S]*?---\n*/, "");
        }

        // Load transcript with speaker attribution
        let transcript = "";
        const hasTranscript = existsSync(transcriptJsonPath) || existsSync(transcriptPath);
        if (existsSync(transcriptJsonPath)) {
          const transcriptJson = JSON.parse(await readFile(transcriptJsonPath, "utf-8")) as TranscriptUtterance[];
          if (transcriptJson && transcriptJson.length > 0) {
            transcript = transcriptWithSpeakers(transcriptJson);
          }
        } else if (existsSync(transcriptPath)) {
          transcript = await readFile(transcriptPath, "utf-8");
        }

        // Extract folders
        const docFolders: string[] = [];
        if (existsSync(notesPath)) {
          const notesContent = await readFile(notesPath, "utf-8");
          const folderMatch = notesContent.match(/folders:\s*\[(.*?)\]/);
          if (folderMatch) {
            const folderStr = folderMatch[1];
            const folderMatches = folderStr.match(/"([^"]+)"/g);
            if (folderMatches) {
              docFolders.push(...folderMatches.map((f) => f.replace(/"/g, "")));
            }
          }
        }

        // Extract insights
        let insights = {
          insights_summary: notes.substring(0, 500) || "No summary available",
          themes: [] as Theme[],
          key_quotes: [] as Quote[],
        };

        if (!options.skipExtraction && (transcript || notes)) {
          console.log(`Extracting insights for: ${docJson.title || dir.name}`);
          insights = await extractInsights(
            transcript,
            notes,
            docJson.title || dir.name,
            options.model
          );
        }

        // Create indexed document
        const indexedDoc: IndexedDocument = {
          id: docJson.id,
          title: docJson.title || dir.name,
          folders: docFolders,
          created_at: docJson.created_at,
          updated_at: docJson.updated_at,
          granola_summary: notes,
          themes: insights.themes,
          key_quotes: insights.key_quotes,
          insights_summary: insights.insights_summary,
          has_transcript: hasTranscript,
        };

        // Generate embeddings
        const summaryText = createSearchableText({
          type: "summary",
          text: insights.insights_summary,
        });
        const summaryVector = await generateEmbedding(summaryText);

        indexedDocs.push({ doc: indexedDoc, summaryVector });

        // Create chunks for themes
        for (const theme of insights.themes) {
          const evidenceTexts = theme.evidence.map(e =>
            `[${e.speaker === 'me' ? 'ME' : 'PARTICIPANT'}] ${e.text}`
          );
          const themeText = createSearchableText({
            type: "theme",
            text: `${theme.description}. Evidence: ${evidenceTexts.join(" | ")}`,
            theme_name: theme.name,
          });
          const themeVector = await generateEmbedding(themeText);
          allChunks.push({
            id: `${docJson.id}_theme_${theme.name}`,
            document_id: docJson.id,
            content: theme.description,
            type: "theme",
            theme_name: theme.name,
            vector: themeVector,
          });
        }

        // Create chunks for quotes
        for (let i = 0; i < insights.key_quotes.length; i++) {
          const quote = insights.key_quotes[i];
          const quoteText = createSearchableText({
            type: "quote",
            text: quote.text,
            context: quote.context,
          });
          const quoteVector = await generateEmbedding(quoteText);
          allChunks.push({
            id: `${docJson.id}_quote_${i}`,
            document_id: docJson.id,
            content: quote.text,
            type: "quote",
            timestamp: quote.timestamp,
            vector: quoteVector,
          });
        }

        processed++;
        console.log(`Processed ${processed}/${docDirs.length}`);
      }

      // Store in vector database
      console.log("\nStoring in vector database...");
      await storeDocuments(dbPath, indexedDocs);
      await storeChunks(dbPath, allChunks);

      console.log(`
Sync complete!
- Documents exported: ${exported}
- Documents indexed: ${indexedDocs.length}
- Chunks created: ${allChunks.length}
- Database: ${dbPath}
`);
    } catch (error) {
      console.error("Error:", (error as Error).message);
      process.exit(1);
    }
  });

program.parse();

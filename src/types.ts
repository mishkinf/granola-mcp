// Core data models for the Granola Data Access System

export type Speaker = 'me' | 'participant';

export interface ThemeEvidence {
  text: string;
  speaker: Speaker;
}

export interface Theme {
  name: string;           // e.g., "pricing-concerns", "feature-request"
  description: string;    // Brief explanation
  evidence: ThemeEvidence[];  // Supporting quotes with speaker attribution
}

export interface Quote {
  text: string;           // The actual quote
  speaker: Speaker;       // Who said it: 'me' (you) or 'participant' (others)
  timestamp?: string;     // When it was said
  context: string;        // What was being discussed
  theme?: string;         // Related theme
}

export interface IndexedDocument {
  id: string;
  title: string;
  folders: string[];
  created_at: string;
  updated_at?: string;

  // From Granola
  granola_summary: string;         // Granola's AI-generated notes

  // Generated at index time
  themes: Theme[];                 // Extracted themes with evidence
  key_quotes: Quote[];             // Notable quotes with timestamps
  insights_summary: string;        // 2-3 sentence distillation

  // For search
  has_transcript: boolean;
}

// What gets stored in the vector database
export interface ChunkRecord {
  id: string;
  document_id: string;
  content: string;
  type: 'quote' | 'theme' | 'summary' | 'granola_summary';
  theme_name?: string;
  timestamp?: string;
  vector: number[];
}

export interface DocumentRecord {
  id: string;
  title: string;
  folders: string[];
  created_at: string;
  insights_summary: string;
  granola_summary: string;
  themes_json: string;      // JSON stringified Theme[]
  key_quotes_json: string;  // JSON stringified Quote[]
  has_transcript: boolean;
  summary_vector: number[];
}

// Search results
export interface SearchResult {
  document: {
    id: string;
    title: string;
    folders: string[];
    date: string;
  };
  relevance_score: number;
  summary: string;
  matching_themes: string[];
  key_quotes: Quote[];
  full_transcript_available: boolean;
  total_quotes_available: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  themes_found: Record<string, { document_count: number; total_quotes: number }>;
}

// Theme search results
export interface ThemeSearchResult {
  theme: string;
  documents: Array<{
    id: string;
    title: string;
    folders: string[];
    date: string;
    evidence: ThemeEvidence[];
    key_quotes: Quote[];
  }>;
  total_evidence_count: number;
}

// Extracted insights from GPT
export interface ExtractedInsights {
  insights_summary: string;
  themes: Array<{
    name: string;
    description: string;
    evidence: Array<{
      text: string;
      speaker: Speaker;
    }>;
  }>;
  key_quotes: Array<{
    text: string;
    speaker: Speaker;
    timestamp?: string;
    context: string;
    theme?: string;
  }>;
}

// Pre-defined theme configuration
export interface ThemeDefinition {
  id: string;
  name: string;
  prompt: string;
}

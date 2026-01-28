import OpenAI from 'openai';

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

const DEFAULT_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

export function getEmbeddingDimensions(): number {
  return EMBEDDING_DIMENSIONS;
}

export async function generateEmbedding(
  text: string,
  model: string = DEFAULT_MODEL
): Promise<number[]> {
  const openai = getOpenAI();

  // Truncate very long texts (embedding model has token limits)
  const truncatedText = text.substring(0, 8000);

  // Retry logic for transient errors
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await openai.embeddings.create({
        model,
        input: truncatedText,
      });

      return response.data[0].embedding;
    } catch (error) {
      lastError = error as Error;
      const isRetryable = lastError.message?.includes('Connection') ||
                          lastError.message?.includes('timeout') ||
                          lastError.message?.includes('ECONNRESET') ||
                          lastError.message?.includes('rate limit');

      if (isRetryable && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

export async function generateEmbeddings(
  texts: string[],
  model: string = DEFAULT_MODEL,
  options: {
    batchSize?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<number[][]> {
  const openai = getOpenAI();
  const { batchSize = 100, onProgress } = options;
  const results: number[][] = [];

  // Process in batches (OpenAI supports up to 2048 texts per request)
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    // Truncate each text
    const truncatedBatch = batch.map(t => t.substring(0, 8000));

    const response = await openai.embeddings.create({
      model,
      input: truncatedBatch,
    });

    // Sort by index to maintain order
    const sortedData = response.data.sort((a, b) => a.index - b.index);
    for (const item of sortedData) {
      results.push(item.embedding);
    }

    onProgress?.(Math.min(i + batchSize, texts.length), texts.length);

    // Small delay between batches
    if (i + batchSize < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}

// Helper to create searchable text from different content types
export function createSearchableText(content: {
  type: 'summary' | 'theme' | 'quote' | 'granola_summary';
  text: string;
  theme_name?: string;
  context?: string;
}): string {
  switch (content.type) {
    case 'summary':
      return `Meeting summary: ${content.text}`;
    case 'granola_summary':
      return `Meeting notes: ${content.text}`;
    case 'theme':
      return `Theme ${content.theme_name}: ${content.text}`;
    case 'quote':
      return content.context
        ? `Quote about ${content.context}: "${content.text}"`
        : `Quote: "${content.text}"`;
    default:
      return content.text;
  }
}

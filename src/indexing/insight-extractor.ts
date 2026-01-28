import OpenAI from 'openai';
import type { ExtractedInsights, Speaker } from '../types.js';
import { getThemePromptList, getThemeNames } from './themes.js';

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

export async function extractInsights(
  transcript: string,
  notes: string,
  title: string,
  model: string = 'gpt-4o-mini'
): Promise<ExtractedInsights> {
  const openai = getOpenAI();
  const themeList = getThemePromptList();
  const themeNames = getThemeNames();

  const systemPrompt = `You are an expert at analyzing meeting transcripts and extracting actionable insights.

IMPORTANT - Speaker Attribution:
The transcript uses speaker labels to distinguish who said what:
- [ME] = The meeting host/note-taker (the person whose meetings these are)
- [PARTICIPANT] = Other people in the meeting (interviewees, colleagues, experts, etc.)

This distinction is CRITICAL. When extracting quotes:
- Quotes from [PARTICIPANT] represent external feedback, user insights, expert opinions
- Quotes from [ME] represent the host's own statements, questions, or ideas

Prioritize extracting quotes from [PARTICIPANT] as these represent external perspectives.

Analyze the provided meeting transcript and notes, then extract:

1. **insights_summary**: A 2-3 sentence summary of the most important takeaways from this meeting. Focus on actionable insights for product development, business decisions, or relationship building.

2. **themes**: Identify which of these themes are present in the meeting:
${themeList}

For each theme found, provide:
- name: The theme ID (e.g., "pain-points")
- description: A brief description of how this theme manifests in this specific meeting
- evidence: 2-5 direct quotes that support this theme, WITH speaker attribution

3. **key_quotes**: Extract 5-10 of the most quotable/insightful moments from the meeting. These should be:
- Memorable statements that capture important points
- Surprising or noteworthy observations
- Clear expressions of needs, concerns, or decisions

For each quote, provide:
- text: The exact quote (clean up filler words but preserve meaning)
- speaker: Either "me" or "participant" based on who said it
- timestamp: If available from the transcript format
- context: Brief description of what was being discussed (1 sentence)
- theme: Which theme this quote relates to (if any)

Focus on extracting insights that would be valuable for:
- Understanding user/customer needs
- Product development decisions
- Business strategy
- Relationship building

Return your analysis as JSON matching this structure:
{
  "insights_summary": "string",
  "themes": [
    {
      "name": "string (theme ID)",
      "description": "string",
      "evidence": [
        { "text": "quote text", "speaker": "me" | "participant" },
        ...
      ]
    }
  ],
  "key_quotes": [
    {
      "text": "string",
      "speaker": "me" | "participant",
      "timestamp": "string or null",
      "context": "string",
      "theme": "string or null"
    }
  ]
}`;

  const userPrompt = `Meeting Title: ${title}

NOTES (Granola's AI-generated summary):
${notes || 'No notes available'}

TRANSCRIPT:
${transcript || 'No transcript available'}

Please analyze this meeting and extract insights as specified.`;

  // Retry logic for transient errors
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3, // Lower temperature for more consistent extraction
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      const parsed = JSON.parse(content) as ExtractedInsights;

      // Helper to validate speaker
      const validateSpeaker = (s: unknown): Speaker =>
        s === 'me' || s === 'participant' ? s : 'participant';

      // Validate and clean up the response
      return {
        insights_summary: parsed.insights_summary || 'No insights extracted',
        themes: (parsed.themes || []).filter(t =>
          t.name && themeNames.includes(t.name) && t.evidence?.length > 0
        ).map(t => ({
          ...t,
          evidence: t.evidence.map(e => {
            // Handle both old string format and new object format
            if (typeof e === 'string') {
              return { text: e, speaker: 'participant' as Speaker };
            }
            return {
              text: e.text || '',
              speaker: validateSpeaker(e.speaker)
            };
          }).filter(e => e.text.length > 0),
        })),
        key_quotes: (parsed.key_quotes || []).map(q => ({
          text: q.text || '',
          speaker: validateSpeaker(q.speaker),
          timestamp: q.timestamp || undefined,
          context: q.context || 'Context not provided',
          theme: q.theme && themeNames.includes(q.theme) ? q.theme : undefined,
        })).filter(q => q.text.length > 0),
      };
    } catch (error) {
      lastError = error as Error;
      const isRetryable = lastError.message?.includes('Connection') ||
                          lastError.message?.includes('timeout') ||
                          lastError.message?.includes('ECONNRESET') ||
                          lastError.message?.includes('rate limit');

      if (isRetryable && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`  Retry ${attempt}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      break;
    }
  }

  // All retries failed
  console.error(`Error extracting insights for "${title}":`, lastError);
  // Return minimal insights on error
  return {
    insights_summary: notes?.substring(0, 200) || 'Extraction failed',
    themes: [],
    key_quotes: [],
  };
}

// Batch extraction with rate limiting
export async function extractInsightsBatch(
  documents: Array<{
    id: string;
    title: string;
    transcript: string;
    notes: string;
  }>,
  options: {
    model?: string;
    concurrency?: number;
    onProgress?: (completed: number, total: number, title: string) => void;
  } = {}
): Promise<Map<string, ExtractedInsights>> {
  const { model = 'gpt-4o-mini', concurrency = 3, onProgress } = options;
  const results = new Map<string, ExtractedInsights>();

  // Process in batches to avoid rate limits
  for (let i = 0; i < documents.length; i += concurrency) {
    const batch = documents.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map(async (doc) => {
        const insights = await extractInsights(doc.transcript, doc.notes, doc.title, model);
        onProgress?.(i + batch.indexOf(doc) + 1, documents.length, doc.title);
        return { id: doc.id, insights };
      })
    );

    for (const { id, insights } of batchResults) {
      results.set(id, insights);
    }

    // Small delay between batches to avoid rate limits
    if (i + concurrency < documents.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return results;
}

import type { ThemeDefinition } from '../types.js';

// Pre-defined themes for insight extraction
export const THEMES: ThemeDefinition[] = [
  {
    id: 'pain-points',
    name: 'Pain Points',
    prompt: 'User frustrations, problems, complaints, difficulties, blockers',
  },
  {
    id: 'feature-requests',
    name: 'Feature Requests',
    prompt: 'Desired features, wishlist items, "I wish it could...", suggestions for improvement',
  },
  {
    id: 'positive-feedback',
    name: 'Positive Feedback',
    prompt: 'What users liked, praised, found valuable, appreciated, works well',
  },
  {
    id: 'pricing',
    name: 'Pricing',
    prompt: 'Cost concerns, value perception, willingness to pay, budget constraints, pricing feedback',
  },
  {
    id: 'competition',
    name: 'Competition',
    prompt: 'Mentions of competitors, alternatives, comparisons, switching from/to other products',
  },
  {
    id: 'workflow',
    name: 'Workflow',
    prompt: 'How users currently do things, workarounds, existing processes, current tools used',
  },
  {
    id: 'decisions',
    name: 'Decisions',
    prompt: 'Key decisions made, action items, next steps, conclusions, agreements',
  },
  {
    id: 'questions',
    name: 'Questions',
    prompt: 'Open questions raised, things needing clarification, uncertainties, follow-ups needed',
  },
];

export function getThemeById(id: string): ThemeDefinition | undefined {
  return THEMES.find(t => t.id === id);
}

export function getThemeNames(): string[] {
  return THEMES.map(t => t.id);
}

export function getThemePromptList(): string {
  return THEMES.map(t => `- ${t.id}: ${t.prompt}`).join('\n');
}

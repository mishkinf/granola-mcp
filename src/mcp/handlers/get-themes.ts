import { THEMES } from '../../indexing/themes.js';
import { getThemeStats } from '../../indexing/vector-store.js';

export async function handleGetThemes(
  dbPath: string
): Promise<{
  themes: Array<{
    id: string;
    name: string;
    description: string;
    document_count: number;
    total_quotes: number;
  }>;
}> {
  const stats = await getThemeStats(dbPath);

  const themes = THEMES.map(theme => {
    const themeStats = stats.get(theme.id) || { document_count: 0, total_quotes: 0 };
    return {
      id: theme.id,
      name: theme.name,
      description: theme.prompt,
      document_count: themeStats.document_count,
      total_quotes: themeStats.total_quotes,
    };
  });

  return { themes };
}

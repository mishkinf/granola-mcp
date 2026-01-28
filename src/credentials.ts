import { readFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";

interface WorkOSTokens {
  access_token: string;
  refresh_token: string;
}

interface SupabaseCredentials {
  workos_tokens: string;
}

export async function loadAccessToken(): Promise<string> {
  const credsPath = join(
    homedir(),
    "Library/Application Support/Granola/supabase.json"
  );

  try {
    const data = await readFile(credsPath, "utf-8");
    const creds: SupabaseCredentials = JSON.parse(data);
    const workosTokens: WorkOSTokens = JSON.parse(creds.workos_tokens);

    if (!workosTokens.access_token) {
      throw new Error("No access_token found in workos_tokens");
    }

    return workosTokens.access_token;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `Credentials file not found at: ${credsPath}\n` +
          "Make sure Granola is installed and you're logged in."
      );
    }
    throw error;
  }
}

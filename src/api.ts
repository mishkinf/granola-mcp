const API_BASE = "https://api.granola.ai";
const USER_AGENT = "Granola/5.354.0";
const CLIENT_VERSION = "5.354.0";

interface RequestOptions {
  token: string;
  endpoint: string;
  body?: Record<string, unknown>;
}

async function apiRequest<T>(options: RequestOptions): Promise<T> {
  const { token, endpoint, body = {} } = options;

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "*/*",
      "User-Agent": USER_AGENT,
      "X-Client-Version": CLIENT_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }

  return response.json();
}

export interface GranolaDocument {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  workspace_id?: string;
  last_viewed_panel?: {
    content?: ProseMirrorDoc;
  };
}

export interface ProseMirrorDoc {
  type: string;
  content?: ProseMirrorNode[];
}

export interface ProseMirrorNode {
  type: string;
  content?: ProseMirrorNode[];
  text?: string;
  attrs?: Record<string, unknown>;
}

export interface TranscriptUtterance {
  source: "microphone" | "system";
  text: string;
  start_timestamp: string;
  end_timestamp: string;
  confidence?: number;
}

export interface Workspace {
  id: string;
  name: string;
  created_at: string;
  owner_id?: string;
}

interface WorkspaceApiResponse {
  workspaces: Array<{
    workspace: {
      workspace_id: string;
      display_name: string;
      slug: string;
      created_at: string;
    };
    role: string;
    plan_type: string;
  }>;
}

export interface DocumentList {
  id: string;
  name?: string;
  title?: string;
  created_at?: string;
  workspace_id?: string;
  document_ids?: string[];
  documents?: { id: string }[];
}

interface DocumentListsApiResponse {
  lists: DocumentList[];
}

interface GetDocumentsResponse {
  docs: GranolaDocument[];
}

export async function getDocuments(
  token: string,
  limit = 100,
  offset = 0
): Promise<GranolaDocument[]> {
  const response = await apiRequest<GetDocumentsResponse>({
    token,
    endpoint: "/v2/get-documents",
    body: {
      limit,
      offset,
      include_last_viewed_panel: true,
    },
  });

  return response.docs;
}

export async function getAllDocuments(token: string): Promise<GranolaDocument[]> {
  const allDocs: GranolaDocument[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const docs = await getDocuments(token, limit, offset);
    allDocs.push(...docs);

    if (docs.length < limit) {
      break;
    }
    offset += limit;
  }

  return allDocs;
}

export async function getDocumentTranscript(
  token: string,
  documentId: string
): Promise<TranscriptUtterance[] | null> {
  try {
    const response = await apiRequest<TranscriptUtterance[]>({
      token,
      endpoint: "/v1/get-document-transcript",
      body: { document_id: documentId },
    });
    return response;
  } catch (error) {
    // 404 means no transcript exists for this document
    if (error instanceof Error && error.message.includes("404")) {
      return null;
    }
    throw error;
  }
}

export async function getWorkspaces(token: string): Promise<Workspace[]> {
  const response = await apiRequest<WorkspaceApiResponse>({
    token,
    endpoint: "/v1/get-workspaces",
    body: {},
  });

  return response.workspaces.map((w) => ({
    id: w.workspace.workspace_id,
    name: w.workspace.display_name || w.workspace.slug,
    created_at: w.workspace.created_at,
  }));
}

export async function getDocumentLists(token: string): Promise<DocumentList[]> {
  try {
    const response = await apiRequest<DocumentListsApiResponse>({
      token,
      endpoint: "/v2/get-document-lists",
      body: {},
    });
    return response.lists || [];
  } catch {
    // Fallback to v1
    const response = await apiRequest<DocumentListsApiResponse>({
      token,
      endpoint: "/v1/get-document-lists",
      body: {},
    });
    return response.lists || [];
  }
}

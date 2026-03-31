
export interface ProcessedDocument {
  kb_id: string;
  filename: string;
  chunks_stored: number;
  message: string;
}

/**
 * Upload and process a document for the knowledge base
 * This extracts text, creates embeddings, and stores in ChromaDB
 */
export async function uploadDocument(
  file: File,
  geminiApiKey: string,
  workflowId?: string,
  embeddingModel?: string
): Promise<ProcessedDocument> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("gemini_api_key", geminiApiKey);
  if (workflowId) {
    formData.append("workflow_id", workflowId);
  }
  if (embeddingModel) {
    formData.append("embedding_model", embeddingModel);
  }

  // Get the current session token from localStorage
  const accessToken = localStorage.getItem("access_token");

  if (!accessToken) {
    throw new Error("Not authenticated. Please sign in.");
  }

  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
  
  const response = await fetch(`${backendUrl}/api/kb/upload`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Upload failed (${response.status})`);
  }

  return response.json();
}

/**
 * List all documents in the knowledge base
 */
export async function listDocuments(): Promise<{ documents: any[] }> {
  const accessToken = localStorage.getItem("access_token");

  if (!accessToken) {
    throw new Error("Not authenticated. Please sign in.");
  }

  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
  
  const response = await fetch(`${backendUrl}/api/kb/documents`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Failed to list documents (${response.status})`);
  }

  return response.json();
}
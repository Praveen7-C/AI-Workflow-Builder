export const NODE_TYPES = {
  USER_QUERY: "userQuery",
  LLM: "llm",
  KNOWLEDGE_BASE: "knowledgeBase",
  WEB_SEARCH: "webSearch",
  OUTPUT: "output",
} as const;

export const DEFAULT_LLM_CONFIG = {
  model: "gemini-1.5-flash",
  temperature: "0.7",
  prompt: "You are a helpful AI assistant. Use provided context and web search results to answer queries accurately.",
  webSearchEnabled: true,
};

export const DEFAULT_KB_CONFIG = {
  embeddingModel: "text-embedding-3-large",
};

export const AVAILABLE_MODELS = [
  { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
  { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { value: "gpt-4o", label: "GPT-4o (OpenAI)" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini (OpenAI)" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo (OpenAI)" },
] as const;

export const EMBEDDING_MODELS = [
  { value: "text-embedding-3-large", label: "OpenAI text-embedding-3-large" },
  { value: "text-embedding-004", label: "Gemini text-embedding-004" },
] as const;

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

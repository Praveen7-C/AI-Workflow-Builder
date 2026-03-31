export interface Stack {
  id: string;
  name: string;
  description: string;
  nodes: any[];
  edges: any[];
  createdAt: Date;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export type ComponentType = "userQuery" | "llm" | "knowledgeBase" | "output" | "webSearch" | "userQueryNode" | "llmNode" | "knowledgeBaseNode" | "outputNode" | "webSearchNode";

export interface ComponentItem {
  type: ComponentType;
  label: string;
  icon: string;
}

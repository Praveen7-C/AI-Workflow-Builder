import type { Node } from "@xyflow/react";

// Support both old and new node type naming conventions
const OLD_TO_NEW_TYPE_MAP: Record<string, string> = {
  userQuery: "userQueryNode",
  knowledgeBase: "knowledgeBaseNode",
  llm: "llmNode",
  llmEngine: "llmNode",
  output: "outputNode",
  webSearch: "webSearchNode",
};

// Normalize node type to the new naming convention
const normalizeNodeType = (type: string | undefined | null): string => {
  if (!type) return "";
  return OLD_TO_NEW_TYPE_MAP[type] || type;
};

export interface ValidationResult {
  valid: boolean;
  error?: string;
  errors: string[];
}

// Legacy validation function that returns single error string
export const validateWorkflow = (nodes: Node[]) => {
  // Check if all required node types are present
  const normalizedTypes = new Set(nodes.map((node) => normalizeNodeType(node.type)));
  const requiredTypes = ['userQueryNode', 'knowledgeBaseNode', 'llmNode', 'outputNode'];
  
  const missingTypes = requiredTypes.filter((type) => !normalizedTypes.has(type));
  if (missingTypes.length > 0) {
    return {
      valid: false,
      errors: [`Missing required nodes: ${missingTypes.join(', ')}`],
    };
  }

  // Add more validation rules here

  return { valid: true, errors: [] };
};

// Extended validation with detailed errors (for the UI)
export const validateWorkflowDetailed = (nodes: Node[], edges: Node[]): ValidationResult => {
  const errors: string[] = [];

  if (nodes.length === 0) {
    errors.push("Workflow must have at least one node.");
    return { valid: false, errors };
  }

  const normalizedNodeTypes = nodes.map((n) => normalizeNodeType(n.type));
  
  const hasUserQuery = normalizedNodeTypes.includes("userQueryNode");
  const hasOutput = normalizedNodeTypes.includes("outputNode");
  const hasLLM = normalizedNodeTypes.includes("llmNode");
  const hasWebSearch = normalizedNodeTypes.includes("webSearchNode");

  if (!hasUserQuery) errors.push("Workflow must include a User Query node.");
  if (!hasOutput) errors.push("Workflow must include an Output node.");

  // Workflow 3: Query → Web Search → Output (no LLM needed)
  // Workflow 1 & 2: require LLM
  if (!hasLLM && !hasWebSearch) {
    errors.push("Workflow must include either an LLM Engine node or a Web Search node.");
  }

  if (edges.length === 0 && nodes.length > 1) {
    errors.push("Nodes must be connected.");
  }

  // Validate LLM node has required API key
  const llmNodes = nodes.filter((n) => normalizeNodeType(n.type) === "llmNode");
  for (const llm of llmNodes) {
    const config = (llm.data as any)?.config;
    if (!config?.model) {
      errors.push("LLM node must have a model selected.");
    }
    if (!config?.apiKey) {
      errors.push("LLM node must have an API Key configured.");
    }
  }

  return { valid: errors.length === 0, errors };
};

export const getNodeConfig = (node: Node) => {
  const normalizedType = normalizeNodeType(node.type);
  
  const baseConfig: Record<string, { label: string; fields: string[] }> = {
    userQueryNode: {
      label: 'User Query',
      fields: ['query'],
    },
    knowledgeBaseNode: {
      label: 'Knowledge Base',
      fields: ['sources'],
    },
    llmNode: {
      label: 'LLM Engine',
      fields: ['model', 'temperature'],
    },
    outputNode: {
      label: 'Output',
      fields: ['output'],
    },
    webSearchNode: {
      label: 'Web Search',
      fields: ['searchQuery'],
    },
  };

  return baseConfig[normalizedType] || null;
};

export const validateStackName = (name: string): string | null => {
  if (!name.trim()) return "Name is required";
  if (name.length > 100) return "Name must be under 100 characters";
  return null;
};

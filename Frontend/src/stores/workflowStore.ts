import { create } from "zustand";
import type {
  Edge,
  Node,
  OnEdgesChange,
  OnNodesChange,
  OnConnect,
  Connection,
} from "@xyflow/react";
import { applyNodeChanges, applyEdgeChanges, addEdge } from "@xyflow/react";

export interface NodeData {
  label: string;
  name: string;
  type: string;
  config?: {
    apiKey?: string;
    model?: string;
    temperature?: string;
    webSearchEnabled?: boolean;
    serpApiKey?: string;
    serpApi?: string;
    embeddingModel?: string;
    uploadedFile?: File | null;
    uploadedFileName?: string | null;
    query?: string;
    output?: string;
    searchQuery?: string;
    kbId?: string;
    chunksStored?: number;
    prompt?: string;
    name?: string;
  };
  workflowId?: string;
  [key: string]: any;
}

interface WorkflowOverallConfig {
  llm_api_key?: string;
  embedding_api_key?: string;
  serp_api_key?: string;
  web_search_enabled?: boolean;
  temperature?: number;
  model?: string;
  prompt?: string;
}

interface WorkflowState {
  selectedWorkflowId: string | null;
  nodes: Node<NodeData>[];
  edges: Edge[];
  workflowName: string;
  workflowDescription: string;
  workflowConfig: WorkflowOverallConfig;
  isExecuting: boolean;
  executionError: string | null;
  removeNode: (nodeId: string) => void;
  removeEdge: (edgeId: string) => void;
  setSelectedWorkflowId: (id: string | null) => void;
  setNodes: (nodes: Node<NodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  setWorkflowName: (name: string) => void;
  setWorkflowDescription: (description: string) => void;
  draggedType: string | null;
  setDraggedType: (type: string | null) => void;
  resetWorkflowBuilder: () => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (node: Node<NodeData>) => void;
  updateNodeConfig: (
    nodeId: string,
    config: Partial<NodeData["config"]>
  ) => void;
  saveWorkflow: () => Promise<boolean>;
  loadWorkflow: (workflowId: string) => Promise<boolean>;
  executeWorkflow: () => Promise<void>;
  setWorkflowConfig: (config: WorkflowOverallConfig) => void;
}

const API_BASE_URL = (import.meta.env.VITE_BACKEND_URL) + "/api/workflow";

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  selectedWorkflowId: null,
  nodes: [],
  edges: [],
  workflowName: "",
  workflowDescription: "",
  workflowConfig: {},
  isExecuting: false,
  executionError: null,
  draggedType: null,

  setSelectedWorkflowId: (id) => set({ selectedWorkflowId: id }),
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setWorkflowName: (name) => set({ workflowName: name }),
  setWorkflowDescription: (description) => set({ workflowDescription: description }),
  setDraggedType: (type) => set({ draggedType: type }),
  setWorkflowConfig: (config) => set({ workflowConfig: config }),

  resetWorkflowBuilder: () =>
    set({
      selectedWorkflowId: null,
      nodes: [],
      edges: [],
      workflowName: "",
      workflowDescription: "",
      workflowConfig: {},
    }),

  removeNode: (nodeId: string) =>
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== nodeId),
      edges: state.edges.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId
      ),
    })),

  removeEdge: (edgeId: string) =>
    set((state) => ({
      edges: state.edges.filter((edge) => edge.id !== edgeId),
    })),

  onNodesChange: (changes) => {
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes) as Node<NodeData>[],
    }));
  },

  onEdgesChange: (changes) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    }));
  },

  onConnect: (connection) => {
    set((state) => {
      const edgeName = determineEdgeName(connection, state.nodes);
      const newEdge: Edge = {
        id: `e${connection.source}-${connection.target}-${
          connection.targetHandle || "default"
        }-${Date.now()}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        data: { name: edgeName },
      };
      return {
        edges: addEdge(newEdge, state.edges),
      };
    });
  },

  addNode: (node) => {
    set((state) => {
      const nodeWithName = {
        ...node,
        data: {
          ...node.data,
          name: getNodeName(node.data.type),
        },
      };
      return {
        nodes: [...state.nodes, nodeWithName],
      };
    });
  },

  updateNodeConfig: (nodeId, newConfig) => {
    set((state) => {
      const updatedNodes = state.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                config: { ...node.data.config, ...newConfig },
              },
            }
          : node
      );

      const currentWorkflowConfig = { ...state.workflowConfig };
      const nodeBeingUpdated = updatedNodes.find((n) => n.id === nodeId);

      if (nodeBeingUpdated) {
        if (
          nodeBeingUpdated.data.type === "llmNode" &&
          nodeBeingUpdated.data.config
        ) {
          currentWorkflowConfig.llm_api_key =
            nodeBeingUpdated.data.config.apiKey;
          currentWorkflowConfig.model = nodeBeingUpdated.data.config.model;
          currentWorkflowConfig.temperature = parseFloat(
            nodeBeingUpdated.data.config.temperature || "0.7"
          );
          currentWorkflowConfig.web_search_enabled =
            nodeBeingUpdated.data.config.webSearchEnabled;
          currentWorkflowConfig.serp_api_key =
            nodeBeingUpdated.data.config.serpApiKey;
        } else if (
          nodeBeingUpdated.data.type === "knowledgeBaseNode" &&
          nodeBeingUpdated.data.config
        ) {
          currentWorkflowConfig.embedding_api_key =
            nodeBeingUpdated.data.config.apiKey;
        }
      }

      return {
        nodes: updatedNodes,
        workflowConfig: currentWorkflowConfig,
      };
    });
  },

  saveWorkflow: async () => {
    const state = get();
    if (!state.selectedWorkflowId) {
      console.error("No workflow selected to save.");
      return false;
    }

    try {
      // Format nodes for backend storage
      const formattedNodes = state.nodes.map((node) => ({
        id: node.id,
        name: node.data.name || getNodeName(node.data.type),
        type: node.data.type,
        position: node.position,
        config: {
          ...node.data.config,
          // Explicitly include kbId and chunksStored for KnowledgeBaseNode
          kbId: node.data.config?.kbId || null,
          chunksStored: node.data.config?.chunksStored || 0,
          uploadedFile: undefined, // Don't store File objects
        },
      }));

      // Format edges for backend storage
      // FIX: filter ghost edges before saving — edges whose source or target
      // no longer exists in the node list would cause a 500 on execute.
      const nodeIdSet = new Set(state.nodes.map((n) => n.id));
      const formattedEdges = state.edges
        .filter((edge) => nodeIdSet.has(edge.source) && nodeIdSet.has(edge.target))
        .map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
          data: edge.data,
        }));

      const formData = new FormData();
      formData.append("name", state.workflowName);
      formData.append("description", state.workflowDescription);
      formData.append("nodes", JSON.stringify(formattedNodes));
      formData.append("edges", JSON.stringify(formattedEdges));
      formData.append("config", JSON.stringify(state.workflowConfig));

      // Handle file upload for knowledge base node
      let fileToUpload: File | null = null;
      let documentName: string | null = null;

      for (const node of state.nodes) {
        if (
          node.data.type === "knowledgeBaseNode" &&
          node.data.config?.uploadedFile
        ) {
          fileToUpload = node.data.config.uploadedFile as File;
          documentName =
            (node.data.config.uploadedFileName as string) || fileToUpload.name;
          break;
        }
      }

      if (fileToUpload) {
        formData.append(
          "document_file",
          fileToUpload,
          documentName || fileToUpload.name
        );
        if (documentName) {
          formData.append("document_name", documentName);
        }
      }

      const _saveToken = localStorage.getItem("access_token");
      const response = await fetch(
        `${API_BASE_URL}/update/${state.selectedWorkflowId}`,
        {
          method: "PATCH",
          headers: _saveToken ? { Authorization: `Bearer ${_saveToken}` } : {},
          body: formData,
        }
      );

      if (response.status === 200) {
        console.log("Workflow saved successfully to database");
        return true;
      } else {
        const errorData = await response.json();
        console.error("Failed to save workflow:", errorData);
        return false;
      }
    } catch (error: any) {
      console.error("Error saving workflow:", error.message);
      return false;
    }
  },

  loadWorkflow: async (workflowId: string) => {
    try {
      console.log("Loading workflow:", workflowId);
      
      const _loadToken = localStorage.getItem("access_token");
      const response = await fetch(`${API_BASE_URL}/${workflowId}`, {
        headers: _loadToken ? { Authorization: `Bearer ${_loadToken}` } : {},
      });
      
      if (response.status !== 200) {
        console.error("Failed to load workflow, status:", response.status);
        return false;
      }

      const data = await response.json();
      console.log("Workflow data loaded:", data);
      
      const { name, description, nodes, edges, config } = data;

      // Parse nodes
      let parsedNodes: any[] = [];
      if (typeof nodes === "string" && nodes !== "null" && nodes !== "[]") {
        try {
          parsedNodes = JSON.parse(nodes);
        } catch (e) {
          console.error("Error parsing nodes:", e);
          parsedNodes = [];
        }
      } else if (Array.isArray(nodes)) {
        parsedNodes = nodes;
      }

      // Format nodes for React Flow
      const formattedNodes = parsedNodes.map((node: any) => ({
        id: node.id,
        type: node.type,
        position: node.position || { x: 0, y: 0 },
        data: {
          label: node.name || getNodeName(node.type),
          name: node.name || getNodeName(node.type),
          type: node.type,
          config: {
            ...(node.config || {}),
            // Ensure kbId and chunksStored are loaded from database
            kbId: node.config?.kbId || null,
            chunksStored: node.config?.chunksStored || 0,
            uploadedFile: null,
          },
          workflowId: workflowId,
        },
      }));

      // Parse edges
      let parsedEdges: any[] = [];
      if (typeof edges === "string" && edges !== "null" && edges !== "[]") {
        try {
          parsedEdges = JSON.parse(edges);
        } catch (e) {
          console.error("Error parsing edges:", e);
          parsedEdges = [];
        }
      } else if (Array.isArray(edges)) {
        parsedEdges = edges;
      }

      // Format edges for React Flow
      const formattedEdges = parsedEdges.map((edge: any) => ({
        id: edge.id,
        source: edge.source,
        sourceHandle: edge.sourceHandle || null,
        target: edge.target,
        targetHandle: edge.targetHandle || null,
        data: { name: edge.data?.name || "Unknown" },
      }));

      // Parse config
      let parsedConfig: WorkflowOverallConfig = {};
      if (typeof config === "string" && config !== "null" && config !== "{}") {
        try {
          parsedConfig = JSON.parse(config);
        } catch (e) {
          console.error("Error parsing config:", e);
          parsedConfig = {};
        }
      } else if (typeof config === "object" && config !== null) {
        parsedConfig = config;
      }

      // Update store with loaded data
      set({
        selectedWorkflowId: workflowId,
        workflowName: name || "",
        workflowDescription: description || "",
        nodes: formattedNodes,
        edges: formattedEdges,
        workflowConfig: parsedConfig,
      });

      console.log("Workflow loaded successfully:", {
        nodes: formattedNodes.length,
        edges: formattedEdges.length,
        name,
      });

      return true;
    } catch (error: any) {
      console.error("Error loading workflow:", error.message);
      return false;
    }
  },

  executeWorkflow: async () => {
    const { selectedWorkflowId, nodes } = get();
    if (!selectedWorkflowId) {
      console.error("No workflow selected to execute.");
      return;
    }

    const userQueryNode = nodes.find(
      (node) => node.data.type === "userQueryNode"
    );
    const query = userQueryNode?.data.config?.query || "";

    set({ isExecuting: true, executionError: null });

    try {
      const _executeToken = localStorage.getItem("access_token");
      const response = await fetch(
        `${API_BASE_URL}/execute/${selectedWorkflowId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(_executeToken ? { Authorization: `Bearer ${_executeToken}` } : {}),
          },
          body: JSON.stringify({ query }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to execute workflow");
      }

      const result = await response.json();
      console.log("Workflow executed successfully:", result);

      // Access the output from the correct path: result.workflow_response.final_response
      const workflowOutput = result.workflow_response?.final_response || "No output generated";

      set((state) => ({
        nodes: state.nodes.map((node) =>
          node.data.type === "outputNode"
            ? {
                ...node,
                data: { ...node.data, config: { ...node.data.config, output: workflowOutput } },
              }
            : node
        ),
        isExecuting: false,
      }));
    } catch (error: any) {
      console.error("Error executing workflow:", error.message);
      set({ isExecuting: false, executionError: error.message });
    }
  },
}));

function getNodeName(type: string): string {
  switch (type) {
    case "userQueryNode":
      return "UserQuery";
    case "knowledgeBaseNode":
      return "KnowledgeBase";
    case "llmNode":
      return "LLMEngine";
    case "outputNode":
      return "Output";
    case "webSearchNode":
      return "WebSearch";
    default:
      return type;
  }
}

function determineEdgeName(
  connection: Connection,
  nodes: Node<NodeData>[]
): string {
  const { source, target, sourceHandle, targetHandle } = connection;
  const sourceNode = nodes.find((node) => node.id === source);
  const targetNode = nodes.find((node) => node.id === target);

  if (!sourceNode || !targetNode) return "Unknown";

  if (sourceNode.data.type === "userQueryNode" && sourceHandle === "source") {
    return "Query";
  }
  if (
    targetNode.data.type === "knowledgeBaseNode" &&
    targetHandle === "target"
  ) {
    return "Query Intake";
  }
  if (
    sourceNode.data.type === "knowledgeBaseNode" &&
    sourceHandle === "source"
  ) {
    return "Context";
  }
  if (targetNode.data.type === "llmNode" && targetHandle === "context") {
    return "Context";
  }
  if (targetNode.data.type === "llmNode" && targetHandle === "query") {
    return "Query";
  }
  if (sourceNode.data.type === "llmNode" && sourceHandle === "source") {
    return "Answer";
  }
  if (targetNode.data.type === "outputNode" && targetHandle === "target") {
    return "Answer";
  }

  return "Unknown";
}
import { useCallback, useRef, useState, useEffect, Component, ReactNode } from "react";
import Draggable from 'react-draggable';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type NodeChange,
  type EdgeChange,
  type Connection,
  ConnectionLineType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Play, MessageCircle, Workflow, Lock, Unlock, Logs} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import UserQueryNode from "./nodes/UserQueryNode";
import LLMNode from "./nodes/LLMNode";
import { KnowledgeBaseNode } from "./nodes/KnowledgeBaseNode";
import OutputNode from "./nodes/OutputNode";
import WebSearchNode from "./nodes/WebSearchNode";
import ChatDialog from "../ChatDialog";
import ExecutionLogsPanel, { type LogEntry } from "./ExecutionLogsPanel";
import { useWorkflowStore, NodeData } from "@/stores/workflowStore";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// Support both old and new node type names
const nodeTypes = {
  userQuery: UserQueryNode,
  llm: LLMNode,
  knowledgeBase: KnowledgeBaseNode,
  output: OutputNode,
  webSearch: WebSearchNode,
  userQueryNode: UserQueryNode,
  llmNode: LLMNode,
  knowledgeBaseNode: KnowledgeBaseNode,
  outputNode: OutputNode,
  webSearchNode: WebSearchNode,
};

// Error Boundary Component (from provided code)
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error in component:", error, errorInfo);
    this.setState({ errorInfo: errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4 bg-red-50 rounded-lg shadow-md">
          <h2 className="text-xl font-bold text-red-700 mb-2">Something went wrong.</h2>
          <p className="text-red-600 text-center mb-4">
            We're sorry for the inconvenience. Please try refreshing the page.
          </p>
          {this.state.error && (
            <details className="text-sm text-red-500 bg-red-100 p-3 rounded-md overflow-auto max-h-40 w-full">
              <summary>Error Details</summary>
              <pre className="whitespace-pre-wrap break-words">
                {this.state.error.toString()}
                <br />
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

interface WorkflowCanvasProps {
  workflowId: string;
  onSave: () => void;
}

const WorkflowCanvasInner = ({ workflowId, onSave }: WorkflowCanvasProps) => {
  const minimapRef = useRef(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const draggableRef = useRef(null);
  const { screenToFlowPosition } = useReactFlow();
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [interactive, setInteractive] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [logsVisible, setLogsVisible] = useState(false);


  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, removeNode, removeEdge, draggedType, setDraggedType, updateNodeConfig } = useWorkflowStore();
  const { user, session } = useAuth();

  const addLog = useCallback((level: LogEntry["level"], step: string, message: string) => {
    setLogs((prev) => [
      ...prev,
      {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        level,
        step,
        message,
      },
    ]);
  }, []);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
    },
    [onNodesChange]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
    },
    [onEdgesChange]
  );

  const handleConnect = useCallback(
    (params: Connection) => {
      if (params.target && params.targetHandle) {
        onConnect({
          ...params,
          targetHandle: params.targetHandle,
        });
      }
    },
    [onConnect]
  );

  // Handle keyboard events for delete (from provided code)
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === "Delete") {
      const selectedNodes = nodes.filter((node) => node.selected);
      selectedNodes.forEach((node) => {
        removeNode(node.id);
      });
      const selectedEdges = edges.filter((edge) => edge.selected);
      selectedEdges.forEach((edge) => {
        removeEdge(edge.id);
      });
    }
  }, [nodes, edges, removeNode, removeEdge]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow");
      if (type && reactFlowInstance) {
        const reactFlowBounds = (
          event.target as HTMLElement
        ).getBoundingClientRect();
        const position = screenToFlowPosition({
          x: event.clientX - reactFlowBounds.left,
          y: event.clientY - reactFlowBounds.top,
        });

        // Initialize config as an empty object first, then merge specific properties
        // Using the provided code's default configurations
        const defaultNodeData: NodeData = {
          label: `${type} Node`,
          name: getNodeName(type),
          type: getNodeType(type),
          config: {}, // Always initialize config as an empty object
          workflowId: workflowId,
        };

        if (type === "llmNode" || type === "llm") {
          defaultNodeData.label = "LLM Node";
          defaultNodeData.name = "LLMEngine";
          defaultNodeData.config = { // Merge specific config properties (from provided code)
            ...defaultNodeData.config,
            model: "gemini-3-flash-preview",
            apiKey: "",
            temperature: "0.7",
            webSearchEnabled: true,
            serpApiKey: "",
          };
        } else if (type === "knowledgeBaseNode" || type === "knowledgeBase") {
          defaultNodeData.label = "Knowledge Base Node";
          defaultNodeData.name = "KnowledgeBase";
          defaultNodeData.config = { // Merge specific config properties (from provided code)
            ...defaultNodeData.config,
            embeddingModel: "text-embedding-3-large",
            apiKey: "",
            uploadedFileName: "",
            uploadedFile: null,
          };
        } else if (type === "userQueryNode" || type === "userQuery") {
          defaultNodeData.label = "User Query Node";
          defaultNodeData.name = "UserQuery";
          defaultNodeData.config = { // Merge specific config properties (from provided code)
            ...defaultNodeData.config,
            query: "Write your query here"
          };
        } else if (type === "outputNode" || type === "output") {
          defaultNodeData.label = "Output Node";
          defaultNodeData.name = "Output";
          defaultNodeData.config = { // Merge specific config properties (from provided code)
            ...defaultNodeData.config,
            output: "Workflow output will appear here."
          };
        } else if (type === "webSearchNode" || type === "webSearch") {
          defaultNodeData.label = "Web Search Node";
          defaultNodeData.name = "WebSearch";
          defaultNodeData.config = { // Merge specific config properties
            ...defaultNodeData.config,
            searchQuery: ""
          };
        }

        const newNode: Node = {
          id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: getNodeType(type),
          position,
          data: defaultNodeData,
        };

        addNode(newNode);
        setDraggedType(null);
      }
    },
    [screenToFlowPosition, addNode, setDraggedType, workflowId, reactFlowInstance]
  );

  // Helper function to get node type (converts short names to full names)
  const getNodeType = (type: string): string => {
    switch (type) {
      case "userQuery":
        return "userQueryNode";
      case "knowledgeBase":
        return "knowledgeBaseNode";
      case "llm":
        return "llmNode";
      case "output":
        return "outputNode";
      case "webSearch":
        return "webSearchNode";
      default:
        return type;
    }
  };

  // Helper function to get node name (from provided code)
  const getNodeName = (type: string): string => {
    switch (type) {
      case "userQuery":
      case "userQueryNode":
        return "UserQuery";
      case "knowledgeBase":
      case "knowledgeBaseNode":
        return "KnowledgeBase";
      case "llm":
      case "llmNode":
        return "LLMEngine";
      case "output":
      case "outputNode":
        return "Output";
      case "webSearch":
      case "webSearchNode":
        return "WebSearch";
      default:
        return type;
    }
  };

  const handleRunWorkflow = async () => {
    // Save the workflow before running
    onSave();

    // Use nodes only for basic validation
    if (nodes.length === 0) {
      toast.error("Add at least one node to run the workflow");
      return;
    }

    const hasUserQuery = nodes.some(n => n.type === "userQueryNode" || n.type === "userQuery");
    const hasOutput = nodes.some(n => n.type === "outputNode" || n.type === "output");
    const hasLLM = nodes.some(n => n.type === "llmNode" || n.type === "llm");
    const hasWebSearch = nodes.some(n => n.type === "webSearchNode" || n.type === "webSearch");

    if (!hasUserQuery) {
      toast.error("Workflow must include a User Query node");
      return;
    }
    if (!hasOutput) {
      toast.error("Workflow must include an Output node");
      return;
    }
    if (!hasLLM && !hasWebSearch) {
      toast.error("Workflow must include either an LLM Engine node or a Web Search node");
      return;
    }

    addLog("info", "Workflow", "Starting workflow execution...");
    setInteractive(false);
    setLogsVisible(true);

    try {
      const userQueryNode = nodes.find((node) => node.type === "userQueryNode" || node.type === "userQuery");
      const userQuery = userQueryNode?.data?.config?.query || "";

      const userId = user?.id || "anonymous_user_" + Math.random().toString(36).substr(2, 9);

      // Find all nodes and their execution order based on edges
      const sortedNodes = getExecutionOrder(nodes, edges);
      
      // Log each node preparation
      for (const node of sortedNodes) {
        const nodeType = node.data.type || node.type;
        const nodeName = node.data.name || getNodeName(nodeType);
        addLog("info", "Node", `Preparing ${nodeName} (${nodeType})...`);
      }

      // Log workflow initiation with user query
      addLog("info", "User Query", `Processing query: "${userQuery.substring(0, 50)}${userQuery.length > 50 ? '...' : ''}"`);

      // Use the correct endpoint: /api/execute (from provided code)
      const response = await fetch(`${BACKEND_URL}/api/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow_id: workflowId,
          user_query: userQuery,
          user_id: userId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to execute workflow");
      }

      const data = await response.json();
      const workflowResponse = data.workflow_response;
      const finalResponse = workflowResponse?.final_response || "No response.";

      // Log each node execution result synchronously
      if (workflowResponse) {
        // Log UserQuery execution
        if (workflowResponse.query) {
          addLog("success", "User Query", "Query processed successfully");
        }
        
        // Log KnowledgeBase execution if present
        if (workflowResponse.context) {
          addLog("success", "Knowledge Base", `Retrieved context (${workflowResponse.context.length} characters)`);
        }
        
        // Log LLM execution if present
        if (workflowResponse.response) {
          addLog("success", "LLM Engine", `Generated response (${workflowResponse.response.length} characters)`);
        }
        
        // Log Output execution
        if (workflowResponse.output) {
          addLog("success", "Output", "Output generated successfully");
        }
      }

      addLog("success", "Workflow", "Workflow executed successfully!");

      const outputNode = nodes.find((node) => node.type === "outputNode" || node.type === "output");
      if (outputNode) {
        updateNodeConfig(outputNode.id, {
          output: finalResponse,
        });
      }
      toast.success("Workflow executed successfully");
    } catch (e: any) {
      console.error("Error running workflow:", e);
      addLog("error", "Workflow", e.message || "Error running workflow");
      toast.error(e.message || "Error running workflow");
    } finally {
      setInteractive(true);
    }
  };

  // Helper function to get execution order of nodes based on edges
  const getExecutionOrder = (nodes: Node[], edges: any[]) => {
    // Build adjacency list
    const adjList: Record<string, string[]> = {};
    nodes.forEach(node => {
      adjList[node.id] = [];
    });
    
    edges.forEach(edge => {
      if (adjList[edge.source]) {
        adjList[edge.source].push(edge.target);
      }
    });

    // Find start node (UserQuery)
    const targets = new Set(edges.map(e => e.target));
    const startNode = nodes.find(n => !targets.has(n.id));

    if (!startNode) return nodes;

    // DFS to get execution order
    const visited = new Set<string>();
    const order: Node[] = [];

    const dfs = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      
      const node = nodes.find(n => n.id === nodeId);
      if (node) order.push(node);
      
      const targets = adjList[nodeId] || [];
      targets.forEach(target => dfs(target));
    };

    dfs(startNode.id);

    // Add remaining nodes that might not be connected
    nodes.forEach(node => {
      if (!visited.has(node.id)) {
        order.push(node);
      }
    });

    return order;
  };

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, _node: Node) => {
      if (!interactive) return;
    },
    [interactive]
  );

  const onEdgesDelete = useCallback(
    (_edges: any[]) => {
      if (!interactive) return;
    },
    [interactive]
  );

  return (
    <div className="flex flex-1 h-full relative" ref={reactFlowWrapper}>
      <ErrorBoundary>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={handleConnect}
          nodeTypes={nodeTypes}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeDragStop={onNodeDragStop}
          onEdgesDelete={onEdgesDelete}
          fitView
          connectionLineType={ConnectionLineType.Bezier}
          snapToGrid={true}
          snapGrid={[15, 15]}
          defaultEdgeOptions={{
            type: "bezier",
            animated: true,
            style: { stroke: "#64748b", strokeWidth: 2 },
          }}
        > 
        
          
           <Draggable nodeRef={draggableRef} handle=".minimap-drag-handle" bounds="parent" defaultPosition={{ x: 0, y: 0 }}>
              <div
                ref={draggableRef}
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  zIndex: 20,
                  background: "white",
                  border: "2px solid #e2e8f0",
                  borderRadius: 12,
                  boxShadow: "0 6px 24px rgba(0,0,0,0.16)",
                  overflow: "hidden",
                  width: 280,
                  userSelect: "none",
                }}
              >
                {/* Drag handle bar */}
                <div
                  className="minimap-drag-handle"
                  style={{
                    background: "linear-gradient(90deg, #475569 0%, #64748b 100%)",
                    cursor: "grab",
                    padding: "6px 10px",
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    userSelect: "none",
                  }}
                  title="Drag to move minimap"
                >
                  {/* Grip dots */}
                  <svg width="14" height="10" viewBox="0 0 14 10" fill="none" style={{ flexShrink: 0 }}>
                    {[0,4,8].map(x => [2,6].map(y => (
                      <circle key={`${x}-${y}`} cx={x+1} cy={y+1} r="1.2" fill="white" opacity="0.8"/>
                    )))}
                  </svg>
                  <span style={{ color: "white", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", opacity: 0.9 }}>
                    MINIMAP
                  </span>
                </div>
                <MiniMap
                  nodeColor={(node) => {
                    switch (node.data?.type) {
                      case "userQuery":
                      case "userQueryNode":
                        return "#fbbf24";
                      case "llm":
                      case "llmNode":
                        return "#3b82f6";
                      case "knowledgeBase":
                      case "knowledgeBaseNode":
                        return "#22c55e";
                      case "output":
                      case "outputNode":
                        return "#ef4444";
                      default:
                        return "#94a3b8";
                    }
                  }}
                  style={{ width: 280, height: 180, margin: 0, border: "none", borderRadius: 0 }}
                  className="!static !border-0"
                />
              </div>
           </Draggable>
            
          <Controls 
            className="!absolute !left-4 !z-10 transition-all duration-300" 
            style={{ bottom: logsVisible ? '336px' : '16px' }}
          />
          <Background
            variant={BackgroundVariant.Dots}
            gap={12}
            size={1}
            className="!bg-slate-50"
          />
        </ReactFlow>
      </ErrorBoundary>
      
      {/* Empty state hint */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <p className="text-muted-foreground text-lg">Drag and drop nodes from the left sidebar</p>  
        </div>
      )}

      {/* Floating action buttons - adjusted position when logs are visible */}
      <div 
        className="absolute right-6 flex flex-col gap-2" 
        style={{ 
          zIndex: 30,
          bottom: logsVisible ? '340px' : '24px'
        }}
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" className="h-11 w-11 rounded-full shadow-lg bg-sky-500 hover:bg-sky-600" onClick={handleRunWorkflow}>
                <Play className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Run Workflow</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="secondary"
                className="h-11 w-11 rounded-full border shadow-lg bg-green-400 hover:bg-green-500"
                onClick={() => setChatOpen(true)}
              >
                <MessageCircle className="h-5 w-5 text-white" />
              </Button>
             </TooltipTrigger>
            <TooltipContent>
              <p>Chat with Stack</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={logsVisible ? "default" : "secondary"}
                className="h-11 w-11 rounded-full border shadow-lg bg-violet-500 hover:bg-violet-600"
                onClick={() => setLogsVisible((v) => !v)}
              >
                <Logs className="h-5 w-5 text-white" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{logsVisible ? "Hide Logs" : "Show Logs"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <ExecutionLogsPanel
        logs={logs}
        visible={logsVisible}
        onClear={() => setLogs([])}
        onToggle={() => setLogsVisible((v) => !v)}
      />

      <ChatDialog open={chatOpen} onOpenChange={setChatOpen} workflowId={workflowId} />
    </div>
  );
};

const WorkflowCanvas = (props: WorkflowCanvasProps) => (
  <ReactFlowProvider>
    <WorkflowCanvasInner {...props} />
  </ReactFlowProvider>
);

export default WorkflowCanvas;
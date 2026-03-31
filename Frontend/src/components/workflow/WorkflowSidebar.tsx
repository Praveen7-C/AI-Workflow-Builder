import { useState } from "react";
import { GripVertical, MessageSquare, Brain, Database, ArrowRightFromLine, Globe, Pencil, Check, X } from "lucide-react";
import { ComponentItem } from "@/types/stack";
import { Button } from "@/components/ui/button";

// Support both old and new node type naming conventions
const components: ComponentItem[] = [
  { type: "userQueryNode", label: "User Query", icon: "userQuery" },
  { type: "llmNode", label: "LLM Engine", icon: "llm" },
  { type: "knowledgeBaseNode", label: "Knowledge Base", icon: "knowledgeBase" },
  { type: "webSearchNode", label: "Web Search", icon: "webSearch" },
  { type: "outputNode", label: "Output", icon: "output" },
];

const iconMap: Record<string, React.ReactNode> = {
  userQuery: <MessageSquare className="h-4 w-4" />,
  userQueryNode: <MessageSquare className="h-4 w-4" />,
  llm: <Brain className="h-4 w-4" />,
  llmNode: <Brain className="h-4 w-4" />,
  knowledgeBase: <Database className="h-4 w-4" />,
  knowledgeBaseNode: <Database className="h-4 w-4" />,
  webSearch: <Globe className="h-4 w-4" />,
  webSearchNode: <Globe className="h-4 w-4" />,
  output: <ArrowRightFromLine className="h-4 w-4" />,
  outputNode: <ArrowRightFromLine className="h-4 w-4" />,
};

interface WorkflowSidebarProps {
  stackName: string;
  onRename: (newName: string) => void;
}

const WorkflowSidebar = ({ stackName, onRename }: WorkflowSidebarProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(stackName);

  const handleSave = () => {
    if (editedName.trim() && editedName !== stackName) {
      onRename(editedName.trim());
    } else {
      setEditedName(stackName);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedName(stackName);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  const onDragStart = (event: React.DragEvent, componentType: string) => {
    event.dataTransfer.setData("application/reactflow", componentType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside className="flex w-48 flex-col border-r bg-background">
      <div className="border-b px-3 py-3">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 min-w-0 text-sm font-semibold border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary truncate"
              autoFocus
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleSave}
            >
              <Check className="h-3 w-3 text-green-500" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleCancel}
            >
              <X className="h-3 w-3 text-red-500" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{stackName}</span>
            <button 
              className="shrink-0 rounded p-0.5 hover:bg-muted"
              onClick={() => setIsEditing(true)}
            >
              <svg 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="lucide lucide-pencil h-3.5 w-3.5 text-muted-foreground"
              >
                <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"></path>
                <path d="m15 5 4 4"></path>
              </svg>
            </button>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">Visual Workflow Builder</p>
      </div>

      <div className="px-3 py-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Components
        </p>
        <div className="space-y-1">
          {components.map((comp) => (
            <div
              key={comp.type}
              draggable
              onDragStart={(e) => onDragStart(e, comp.type)}
              className="flex cursor-grab items-center justify-between rounded-md border px-2.5 py-2 text-sm transition-colors hover:bg-muted active:cursor-grabbing"
            >
              <div className="flex items-center gap-2">
                {iconMap[comp.icon]}
                <span className="text-xs">{comp.label}</span>
              </div>
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          ))}
        </div>

        {/* Workflow path hints */}
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Workflows</p>
          <div className="space-y-1.5 text-[10px] text-muted-foreground">
            <p className="leading-tight">
              <span className="font-medium text-foreground">1.</span> Query → KB → LLM → Output
            </p>
            <p className="leading-tight">
              <span className="font-medium text-foreground">2.</span> Query → LLM → Output
            </p>
            <p className="leading-tight">
              <span className="font-medium text-foreground">3.</span> Query → Web Search → Output
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default WorkflowSidebar;

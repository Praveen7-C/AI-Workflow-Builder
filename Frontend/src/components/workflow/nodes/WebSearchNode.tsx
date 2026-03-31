import { memo, useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { Globe, Settings, X, Eye, EyeOff, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkflowStore } from "@/stores/workflowStore";
import type { NodeData } from "@/stores/workflowStore";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

const WebSearchNode = memo(({ id, selected, data }: { id: string; selected?: boolean; data: NodeData }) => {
  const removeNode = useWorkflowStore((s) => s.removeNode);
  const updateNodeConfig = useWorkflowStore((s) => s.updateNodeConfig);
  const [apiKey, setApiKey] = useState(data?.config?.serpApiKey || "");
  const [showKey, setShowKey] = useState(false);
  const [isDeleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className={`w-56 rounded-lg border bg-card shadow-sm ${selected ? 'ring-2 ring-primary' : ''}`}>
      <div className="flex items-center justify-between rounded-t-lg bg-primary/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Web Search</span>
        </div>
        <Popover open={isDeleteOpen} onOpenChange={setDeleteOpen}>
          <PopoverTrigger asChild>
            <button className="ml-auto rounded p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700">
              <Settings className="h-4 w-4 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-2" side="right" align="end">
            <div className="space-y-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-destructive hover:text-destructive"
                onClick={() => {
                  removeNode(id);
                  setDeleteOpen(false);
                }}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => setDeleteOpen(false)}
              >
                <X className="mr-2 h-3.5 w-3.5" />
                Cancel
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <Handle type="target" position={Position.Left} id="query" className="!h-2.5 !w-2.5 !border-2 !border-orange-400 !bg-orange-400" style={{ top: "50%" }} />

      <div className="space-y-3 p-3">
        <p className="text-xs text-primary">Search the web for information</p>
        <div className="space-y-1.5">
          <Label className="text-xs">SERP API Key</Label>
          <div className="relative">
            <Input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); updateNodeConfig(id, { serpApiKey: e.target.value }); }}
              className="h-8 pr-8 text-xs"
              placeholder="Enter API key"
            />
            <button onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2">
              {showKey ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Right} id="results" className="!h-2.5 !w-2.5 !border-2 !border-primary !bg-primary" style={{ top: "70%" }} />
      <div className="px-3 pb-2 text-right">
        <span className="text-[10px] text-muted-foreground">Results</span>
      </div>
    </div>
  );
});

WebSearchNode.displayName = "WebSearchNode";
export default WebSearchNode;
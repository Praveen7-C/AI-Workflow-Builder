import React, { useEffect, useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { MessageSquare, Settings, Trash2, X } from "lucide-react";
import { useWorkflowStore } from "@/stores/workflowStore";
import type { NodeData } from "@/stores/workflowStore";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export const UserQueryNode = ({ id, selected, data }: { id: string; selected?: boolean; data: NodeData }) => {
  const updateNodeConfig = useWorkflowStore((state) => state.updateNodeConfig);
  const removeNode = useWorkflowStore((s) => s.removeNode);
  const [query, setQuery] = useState(
    data.config?.query || "Write your query here"
  );
  const [isDeleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    updateNodeConfig(id, {
      query: query,
      name: data.name || "UserQuery",
    });
  }, [query, id, updateNodeConfig, data.name]);

  return (
    <div className={`w-64 rounded-lg border bg-card shadow-sm ${selected ? 'ring-2 ring-primary' : ''}`}>
      <div className="flex items-center justify-between rounded-t-lg bg-amber-400/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium">User Query</span>
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

      <div className="space-y-3 p-3">
        <p className="text-xs text-amber-600">Entry point for queries</p>
        <div className="space-y-1.5">
          <label className="text-xs font-medium">User Query</label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded border bg-background p-2 text-sm"
            rows={3}
          />
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="source"
        className="!h-2.5 !w-2.5 !border-2 !border-amber-500 !bg-amber-500"
      />
    </div>
  );
};

export default UserQueryNode;
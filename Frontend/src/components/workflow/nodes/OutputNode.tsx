import React, { useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { FileOutput, Settings, Trash2, X, Copy, Check, Eraser } from "lucide-react";
import type { NodeData } from "@/stores/workflowStore";
import { useWorkflowStore } from "@/stores/workflowStore";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export const OutputNode = ({
  id,
  selected,
  data,
}: {
  id: string;
  selected?: boolean;
  data: NodeData;
}) => {
  const removeNode = useWorkflowStore((s) => s.removeNode);
  const updateNodeConfig = useWorkflowStore((s) => s.updateNodeConfig);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const outputText =
    typeof data?.config?.output === "string"
      ? data.config.output
      : "Output will be generated based on query";
  const hasOutput =
    typeof data?.config?.output === "string" && data.config.output.length > 0;

  const handleCopy = () => {
    navigator.clipboard.writeText(outputText);
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 1500);
  };

  const handleClearOutput = () => {
    updateNodeConfig(id, { output: "" });
    setDeleteOpen(false);
  };

  return (
    <div
      className={`w-72 rounded-lg border bg-card shadow-sm ${
        selected ? "border-primary" : ""
      }`}
    >
      <div className="flex items-center gap-2 border-b bg-red-500/20 p-2">
        <FileOutput className="h-4 w-4" />
        <span className="font-medium text-sm">Output</span>
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
                className="w-full justify-start"
                onClick={handleClearOutput}
                disabled={!hasOutput}
              >
                <Eraser className="mr-2 h-3.5 w-3.5" />
                Clear Output
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={handleCopy}
                disabled={!hasOutput || isCopied}
              >
                {isCopied ? (
                  <Check className="mr-2 h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="mr-2 h-3.5 w-3.5" />
                )}
                {isCopied ? "Copied!" : "Copy Output"}
              </Button>
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
      <Handle
        type="target"
        position={Position.Left}
        id="target"
        className="w-4 h-4 !bg-teal-500"
      />
      <div className="space-y-3 p-4">
        <div>
          <label className="text-xs text-muted-foreground">
            Output of the result nodes as text
          </label>
        </div>
        <div>
          <label className="text-xs font-medium">Output Text</label>
          <div className="mt-1 h-24 overflow-y-auto break-words rounded border bg-muted/50 p-2 text-sm whitespace-pre-wrap">
            {outputText}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OutputNode;

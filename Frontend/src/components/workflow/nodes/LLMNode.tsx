import React, { useState, useEffect } from "react";
import { Handle, Position } from "@xyflow/react";
import { Brain, Settings, Trash2, X } from "lucide-react";
import type { NodeData } from "@/stores/workflowStore";
import { useWorkflowStore } from "@/stores/workflowStore";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

/**
 * Valid Gemini models as per official documentation:
 * - https://ai.google.dev/gemini-api/docs/models
 * - https://ai.google.dev/gemini-api/docs/text-generation
 * 
 * Model options:
 * - gemini-2.5-flash: Latest stable flash model with high performance
 * - gemini-2.5-flash-preview-04-17: Preview version of gemini-2.5-flash
 * - gemini-2.0-flash: Previous generation flash model
 * - gemini-1.5-flash: Older stable flash model
 */

export const LLMNode = ({ id, selected, data }: { id: string; selected?: boolean; data: NodeData }) => {
  const updateNodeConfig = useWorkflowStore((state) => state.updateNodeConfig);
  const removeNode = useWorkflowStore((s) => s.removeNode);
  const [isDeleteOpen, setDeleteOpen] = useState(false);

  // Valid Gemini models as per official documentation:
  // https://ai.google.dev/gemini-api/docs/models
  const [model, setModel] = useState(data.config?.model || "gemini-2.5-flash");
  const [apiKey, setApiKey] = useState(data.config?.apiKey || "");
  const [temperature, setTemperature] = useState(
    data.config?.temperature || "0.7"
  );
  const [webSearch, setWebSearch] = useState(
    data.config?.webSearchEnabled ?? true
  );
  const [serpApi, setSerpApi] = useState(data.config?.serpApiKey || "");
  const [prompt, setPrompt] = useState(data.config?.prompt || "");

  useEffect(() => {
    updateNodeConfig(id, {
      model: model,
      apiKey: apiKey,
      temperature: temperature,
      webSearchEnabled: webSearch,
      serpApiKey: serpApi,
      prompt: prompt,
      name: data.name || "LLMEngine",
    });
  }, [
    model,
    apiKey,
    temperature,
    webSearch,
    serpApi,
    prompt,
    id,
    updateNodeConfig,
    data.name,
  ]);

  return (
    <div className={`w-72 rounded-lg border bg-card shadow-sm ${selected ? 'ring-2 ring-primary' : ''}`}>
      <div className="flex items-center justify-between rounded-t-lg bg-blue-500/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium">LLM Engine</span>
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

      <Handle type="target" position={Position.Left} id="context" className="!h-2.5 !w-2.5 !border-2 !border-green-500 !bg-green-500" style={{ top: '60%' }} />
      <Handle type="target" position={Position.Left} id="query" className="!h-2.5 !w-2.5 !border-2 !border-amber-500 !bg-amber-500" style={{ top: '64%' }} />

      <div className="space-y-3 p-3">
        <p className="text-xs text-blue-600">Run a query with an LLM</p>
        
        <div className="space-y-1.5">
          <label className="text-xs font-medium">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full rounded border bg-background p-2 text-sm"
          >
            <option value="gemini-2.5-flash">Gemini 2.5 Flash (Latest)</option>
            <option value="gemini-2.5-flash-preview-04-17">Gemini 2.5 Flash Preview</option>
            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
            <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full rounded border bg-background p-2 text-sm"
            placeholder="API Key"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full rounded border bg-background p-2 text-sm"
            rows={3}
            placeholder="e.g., Answer the query based on the context."
          />
          <div className="mt-1 space-y-1 rounded border bg-background/50 p-2 text-xs">
            <p><span className="font-semibold text-green-600">{"{context}"}</span> - From Knowledge Base</p>
            <p><span className="font-semibold text-amber-600">{"{query}"}</span> - From User Query</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium">Temperature</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="1"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
            className="w-full rounded border bg-background p-2 text-sm"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-xs font-medium">Web Search</label>
          <Switch checked={webSearch} onCheckedChange={setWebSearch} />
        </div>

        {webSearch && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium">SERP API Key</label>
            <input
              type="password"
              value={serpApi}
              onChange={(e) => setSerpApi(e.target.value)}
              className="w-full rounded border bg-background p-2 text-sm"
              placeholder="Enter SERP API key"
            />
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} id="response" className="!h-2.5 !w-2.5 !border-2 !border-blue-500 !bg-blue-500" />
    </div>
  );
};

export default LLMNode;

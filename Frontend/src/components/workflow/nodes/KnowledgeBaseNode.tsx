import React, { useState, useEffect, useCallback, useRef } from "react";
import { Handle, Position } from "@xyflow/react";
import { Database, Upload, Settings, Trash2, X, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useWorkflowStore, type NodeData } from "@/stores/workflowStore";
import { uploadDocument } from "@/lib/knowledgeBase";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export const KnowledgeBaseNode = ({ id, selected, data }: { id: string; selected?: boolean; data: NodeData }) => {
  const updateNodeConfig = useWorkflowStore((state) => state.updateNodeConfig);
  const removeNode = useWorkflowStore((state) => state.removeNode);
  const [isDeleteOpen, setDeleteOpen] = useState(false);

  const [embedding, setEmbedding] = useState(
    data.config?.embeddingModel || "text-embedding-3-large"
  );
  const [apiKey, setApiKey] = useState(data.config?.apiKey || "");
  const [uploadedFileName, setUploadedFileName] = useState(
    data.config?.uploadedFileName || ""
  );
  const [kbId, setKbId] = useState(data.config?.kbId || "");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    updateNodeConfig(id, {
      embeddingModel: embedding,
      apiKey: apiKey,
      uploadedFileName: uploadedFileName,
      kbId: kbId,
    });
  }, [embedding, apiKey, uploadedFileName, kbId, id, updateNodeConfig]);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!apiKey) {
        toast.error("Please enter an API key first");
        return;
      }

      setUploadedFileName(file.name);
      setIsUploading(true);
      setUploadStatus("idle");

      try {
        // Pass the workflowId to ensure document is associated with the correct workflow
        const workflowId = data.workflowId || "";
        const result = await uploadDocument(file, apiKey, workflowId, embedding);
        
        setKbId(result.kb_id);
        setUploadStatus("success");
        
        updateNodeConfig(id, {
          uploadedFileName: file.name,
          kbId: result.kb_id,
          chunksStored: result.chunks_stored,
        });
        
        toast.success(`Document processed! ${result.chunks_stored} chunks stored.`);
      } catch (error: any) {
        console.error("Upload error:", error);
        setUploadStatus("error");
        toast.error(`Upload failed: ${error.message}`);
        
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        setUploadedFileName("");
      } finally {
        setIsUploading(false);
      }
    },
    [apiKey, id, updateNodeConfig]
  );

  const handleDeleteFile = useCallback(() => {
    setUploadedFileName("");
    setKbId("");
    setUploadStatus("idle");
    updateNodeConfig(id, {
      uploadedFile: null,
      uploadedFileName: "",
      kbId: "",
      chunksStored: 0,
    });
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [id, updateNodeConfig]);

  return (
    <div className={`w-72 rounded-lg border bg-card shadow-sm ${selected ? 'ring-2 ring-primary' : ''}`}>
      <Handle type="target" position={Position.Left} id="target" className="!h-2.5 !w-2.5 !border-2 !border-amber-500 !bg-amber-500" />
      
      <div className="flex items-center justify-between rounded-t-lg bg-green-500/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium">Knowledge Base</span>
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
        <p className="text-xs text-green-600">Upload a document for RAG</p>
        
        <div className="space-y-1.5">
          <label className="text-xs font-medium">Gemini API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full rounded border bg-background p-2 text-sm"
            placeholder="Enter Gemini API Key"
            disabled={isUploading}
          />
        </div>
        
        <div className="space-y-1.5">
          <label className="text-xs font-medium">Document (PDF)</label>
          {uploadedFileName ? (
            <div className="mt-1 flex flex-col gap-2 rounded border-2 border-dashed border-green-300 bg-green-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-green-700">
                  {uploadedFileName}
                </span>
                <button
                  onClick={handleDeleteFile}
                  className="shrink-0 rounded p-1 transition-colors hover:bg-red-100"
                  title="Delete file"
                  disabled={isUploading}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </button>
              </div>
              
              {isUploading && (
                <div className="flex items-center gap-2 text-xs text-blue-600">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Processing document...
                </div>
              )}
              
              {uploadStatus === "success" && kbId && (
                <div className="flex items-center gap-2 text-xs text-green-600">
                  <CheckCircle className="h-3 w-3" />
                  Indexed in ChromaDB
                </div>
              )}
              
              {uploadStatus === "error" && (
                <div className="flex items-center gap-2 text-xs text-red-600">
                  <AlertCircle className="h-3 w-3" />
                  Processing failed
                </div>
              )}
            </div>
          ) : (
            <div className="relative mt-1 cursor-pointer rounded border-2 border-dashed border-gray-300 p-3 text-center transition-colors hover:border-gray-400">
              <input
                ref={fileInputRef}
                type="file"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                onChange={handleFileChange}
                accept=".pdf"
                disabled={isUploading || !apiKey}
              />
              {isUploading ? (
                <>
                  <Loader2 className="mx-auto mb-1 h-4 w-4 animate-spin text-blue-500" />
                  <span className="text-xs text-blue-500">Processing...</span>
                </>
              ) : (
                <>
                  <Upload className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {apiKey ? "Upload PDF" : "Enter API key first"}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
        
        <div className="space-y-1.5">
          <label className="text-xs font-medium">Embedding Model</label>
          <select
            value={embedding}
            onChange={(e) => setEmbedding(e.target.value)}
            className="w-full mt-1 rounded border bg-background p-2 text-sm"
            disabled={isUploading}
          >
            <option value="text-embedding-3-large">
              text-embedding-3-large
            </option>
            <option value="text-embedding-004">
              Gemini (text-embedding-004)
            </option>
          </select>
        </div>
        
        {kbId && data.config?.chunksStored > 0 && (
          <div className="rounded bg-muted p-2 text-xs text-muted-foreground">
            {data.config.chunksStored} chunks indexed
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} id="context" className="!h-2.5 !w-2.5 !border-2 !border-green-500 !bg-green-500" />
    </div>
  );
};

export default KnowledgeBaseNode;
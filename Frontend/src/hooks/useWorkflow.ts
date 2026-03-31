import { useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export interface Workflow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  nodes: any[];
  edges: any[];
  config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

const API_BASE_URL = (import.meta.env.VITE_BACKEND_URL || "http://localhost:8000") + "/api/workflow";

export function useWorkflow() {
  const { session } = useAuth();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(false);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = session?.access_token || localStorage.getItem("access_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }, [session]);

  const fetchWorkflows = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/list`, { headers: getAuthHeaders() });
      if (!response.ok) throw new Error("Failed to fetch workflows");
      const data = await response.json();
      setWorkflows(
        (data || []).map((w: any) => ({
          ...w,
          nodes: Array.isArray(w.nodes) ? w.nodes : [],
          edges: Array.isArray(w.edges) ? w.edges : [],
          config: typeof w.config === "object" && w.config !== null ? w.config : {},
        }))
      );
    } catch (err: any) {
      console.error("Failed to load workflows:", err);
      toast.error("Failed to load workflows");
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  const createWorkflow = useCallback(async (name: string, description: string): Promise<Workflow | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/create`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ name, description }),
      });
      if (!response.ok) throw new Error("Failed to create workflow");
      const data = await response.json();
      const workflow: Workflow = {
        id: data.id,
        user_id: data.user_id,
        name: data.name,
        description: data.description,
        nodes: [],
        edges: [],
        config: {},
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
      setWorkflows((prev) => [workflow, ...prev]);
      return workflow;
    } catch (err: any) {
      console.error("Failed to create workflow:", err);
      toast.error("Failed to create workflow");
      return null;
    }
  }, [getAuthHeaders]);

  const updateWorkflow = useCallback(async (
    id: string,
    updates: Partial<Pick<Workflow, "name" | "description" | "nodes" | "edges" | "config">>
  ): Promise<boolean> => {
    try {
      // Simple metadata-only update (name/description)
      if (
        (updates.name !== undefined || updates.description !== undefined) &&
        updates.nodes === undefined && updates.edges === undefined && updates.config === undefined
      ) {
        const formData = new FormData();
        if (updates.name !== undefined) formData.append("name", updates.name);
        if (updates.description !== undefined) formData.append("description", updates.description);
        // Send current nodes/edges/config as empty defaults so the backend accepts the form
        formData.append("nodes", "[]");
        formData.append("edges", "[]");
        formData.append("config", "{}");

        const token = session?.access_token || localStorage.getItem("access_token");
        const response = await fetch(`${API_BASE_URL}/update/${id}`, {
          method: "PATCH",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        if (!response.ok) throw new Error("Failed to update workflow");
        setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, ...updates } : w)));
        return true;
      }
      return true;
    } catch (err: any) {
      console.error("Failed to update workflow:", err);
      toast.error("Failed to update workflow");
      return false;
    }
  }, [session]);

  const deleteWorkflow = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to delete workflow");
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
      return true;
    } catch (err: any) {
      console.error("Failed to delete workflow:", err);
      toast.error("Failed to delete workflow");
      return false;
    }
  }, [getAuthHeaders]);

  const getWorkflow = useCallback(async (id: string): Promise<Workflow | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/${id}`, { headers: getAuthHeaders() });
      if (!response.ok) return null;
      const data = await response.json();
      return {
        ...data,
        nodes: Array.isArray(data.nodes) ? data.nodes : [],
        edges: Array.isArray(data.edges) ? data.edges : [],
        config: typeof data.config === "object" && data.config !== null ? data.config : {},
      };
    } catch (err: any) {
      console.error("Failed to get workflow:", err);
      return null;
    }
  }, [getAuthHeaders]);

  const executeWorkflow = useCallback(
    async (id: string, query: string) => {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || "http://localhost:8000"}/api/execute`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ workflow_id: id, user_query: query }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to execute workflow");
      }
      return response.json();
    },
    [getAuthHeaders]
  );

  return { workflows, loading, fetchWorkflows, createWorkflow, updateWorkflow, deleteWorkflow, getWorkflow, executeWorkflow };
}
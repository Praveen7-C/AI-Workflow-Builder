import { Loader } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import Header from "@/components/Header";
import WorkflowSidebar from "@/components/workflow/WorkflowSidebar";
import WorkflowCanvas from "@/components/workflow/WorkflowCanvas";
import { useWorkflowStore } from "@/stores/workflowStore";
import { toast } from "sonner";

const BuilderPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { nodes, edges, setNodes, setEdges, setWorkflowName, setWorkflowDescription, setSelectedWorkflowId, workflowName, resetWorkflowBuilder, loadWorkflow, saveWorkflow } = useWorkflowStore();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!id) { navigate("/stacks"); return; }
    resetWorkflowBuilder();
    setSelectedWorkflowId(id);

    loadWorkflow(id).then((success) => {
      if (!success) { navigate("/stacks"); return; }
      setLoaded(true);
    });
  }, [id]);

  const handleSave = useCallback(async () => {
    if (!id) return;
    const ok = await saveWorkflow();
    if (ok) toast.success("Workflow saved!");
  }, [id, saveWorkflow]);

  const handleRename = useCallback(async (newName: string) => {
    setWorkflowName(newName);
    if (id) {
      const ok = await saveWorkflow();
      if (ok) {
        toast.success("Stack renamed!");
      }
    }
  }, [id, saveWorkflow, setWorkflowName]);

  if (!loaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader color="#00ff47" className="animate-spin" />
          <p className="text-muted-foreground">Loading workflow...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <Header onSave={handleSave} />
      <div className="flex flex-1 overflow-hidden">
        <WorkflowSidebar stackName={workflowName || "Untitled"} onRename={handleRename} />
        <WorkflowCanvas workflowId={id!} onSave={handleSave} />
      </div>
    </div>
  );
};

export default BuilderPage;
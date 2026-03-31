import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ExternalLink, Trash2, Edit2, Ellipsis, X, Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Header from "@/components/Header";
import CreateStackDialog from "@/components/CreateStackDialog";
import { useWorkflow, Workflow } from "@/hooks/useWorkflow";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const StacksPage = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editStack, setEditStack] = useState<Workflow | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [activePopover, setActivePopover] = useState<string | null>(null);
  const navigate = useNavigate();
  const { workflows, loading, fetchWorkflows, createWorkflow, deleteWorkflow, updateWorkflow } = useWorkflow();

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const handleCreate = async (name: string, description: string) => {
    const workflow = await createWorkflow(name, description);
    if (workflow) {
      toast.success("Stack created successfully!");
      navigate(`/builder/${workflow.id}`);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const success = await deleteWorkflow(deleteId);
    if (success) {
      setDeleteId(null);
      toast.success("Stack deleted successfully");
      fetchWorkflows();
    }
  };

  const handleEditSave = async () => {
    if (!editStack) return;
    const ok = await updateWorkflow(editStack.id, { name: editName, description: editDesc });
    if (ok) {
      toast.success("Stack updated successfully");
      setEditStack(null);
      fetchWorkflows();
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 px-6 py-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 
            className="text-xl font-bold cursor-pointer hover:text-primary transition-colors" 
            onClick={() => navigate("/")}
            title="Go to Homepage"
          >
            My Stacks
          </h1>
          <Button onClick={() => setDialogOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            New Stack
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center pt-16">
            <div className="flex items-center space-x-2">
              <Loader color="#00ff47" className="animate-spin" />
              <p className="text-muted-foreground">Loading workflows...</p>
            </div>
          </div>
        ) : workflows.length === 0 ? (
          <div className="flex justify-center pt-16">
            <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
              <h2 className="mb-2 text-lg font-semibold">Create New Stack</h2>
              <p className="mb-5 text-sm text-muted-foreground">
                Start building your generative AI apps with our essential tools and frameworks
              </p>
              <Button onClick={() => setDialogOpen(true)} className="gap-1.5">
                <Plus className="h-4 w-4" />
                New Stack
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {workflows.map((stack) => (
              <div key={stack.id} className="group rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md relative">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="font-semibold truncate pr-2">{stack.name}</h3>
                  <Popover open={activePopover === stack.id} onOpenChange={(isOpen) => setActivePopover(isOpen ? stack.id : null)}>
                    <PopoverTrigger asChild>
                      <button className="absolute top-3 right-3 p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity">
                        <Ellipsis className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-40 p-2" side="right" align="end">
                      <div className="space-y-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start gap-2"
                          onClick={() => {
                            setEditStack(stack);
                            setEditName(stack.name);
                            setEditDesc(stack.description);
                            setActivePopover(null);
                          }}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          Rename
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                          onClick={() => {
                            setDeleteId(stack.id);
                            setActivePopover(null);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start gap-2"
                          onClick={() => setActivePopover(null)}
                        >
                          <X className="h-3.5 w-3.5" />
                          Cancel
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <p className="mb-4 text-sm text-muted-foreground line-clamp-2">
                  {stack.description || "No description"}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => navigate(`/builder/${stack.id}`)}
                >
                  Edit Stack
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </main>

      <CreateStackDialog open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={handleCreate} />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stack?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. All workflow data and chat history will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editStack} onOpenChange={(open) => !open && setEditStack(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Stack</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Stack name" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} placeholder="Stack description" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditStack(null)}>Cancel</Button>
              <Button onClick={handleEditSave} disabled={!editName.trim()}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StacksPage;
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface CreateStackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, description: string) => void;
}

const CreateStackDialog = ({
  open,
  onOpenChange,
  onSubmit,
}: CreateStackDialogProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit(name.trim(), description.trim());
    setName("");
    setDescription("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Stack</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="stack-name">Name</Label>
            <Input
              id="stack-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Chat With PDF"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stack-desc">Description</Label>
            <Textarea
              id="stack-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Chat with your pdf docs"
              rows={4}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!name.trim()}>
              Create
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateStackDialog;

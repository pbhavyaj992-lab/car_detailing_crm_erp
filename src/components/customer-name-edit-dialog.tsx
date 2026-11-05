import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { renameCustomer } from "@/lib/api/customers";

export function CustomerNameEditDialog({
  open,
  onOpenChange,
  customerId,
  currentName,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  customerId: string;
  currentName: string;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(currentName);
  const [reason, setReason] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const next = name.trim();
      if (!next) throw new Error("Enter a customer name");
      if (next === currentName.trim()) throw new Error("The name is unchanged");
      await renameCustomer(customerId, next, reason.trim() || null);
    },
    onSuccess: () => {
      toast.success("Name updated. The change is recorded in the activity log.");
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer", customerId] });
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["activity", "customer", customerId] });
      onSaved?.();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update the name"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit customer name</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border border-warning/40 bg-warning/5 p-2 text-xs">
            This renames the customer on every quotation, invoice and job. The old and new name are
            saved in the activity log with your name and the time.
          </div>
          <div>
            <Label>Current name</Label>
            <Input className="mt-1" value={currentName} readOnly disabled />
          </div>
          <div>
            <Label>New name</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <Label>Reason (optional)</Label>
            <Textarea
              className="mt-1"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Spelling correction requested by the customer"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save name</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

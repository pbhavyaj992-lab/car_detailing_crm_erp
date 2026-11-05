import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { COMPANY_STATUSES, updateCompany, subscriptionState, type Company } from "@/lib/api/companies";

function toInput(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function addMonths(from: string, months: number) {
  const base = from ? new Date(from) : new Date();
  const d = new Date(base.getTime());
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/**
 * Simple subscription control for a tenant: start date, end date and status.
 * No plan tiers — validity is decided purely by the date window.
 */
export function ManageSubscription({
  company,
  onClose,
}: {
  company: Company | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [status, setStatus] = useState("active");
  const [graceDays, setGraceDays] = useState("3");

  useEffect(() => {
    if (!company) return;
    setStart(toInput(company.subscription_started_at) || new Date().toISOString().slice(0, 10));
    setEnd(toInput(company.subscription_ends_at));
    setStatus(company.status);
    setGraceDays(String(company.grace_days ?? 3));
  }, [company]);

  const save = useMutation({
    mutationFn: async () => {
      if (!company) return;
      if (start && end && new Date(end) < new Date(start)) {
        throw new Error("End date must be after the start date");
      }
      await updateCompany(company.id, {
        status,
        grace_days: Number(graceDays || 0),
        subscription_started_at: start ? new Date(`${start}T00:00:00`).toISOString() : null,
        subscription_ends_at: end ? new Date(`${end}T23:59:59`).toISOString() : null,
      } as never);
    },
    onSuccess: () => {
      toast.success("Subscription updated");
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["my-subscription"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!company) return null;
  const state = subscriptionState(company);

  return (
    <Dialog open={!!company} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" /> Subscription — {company.name}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Current state: <span className="font-medium capitalize">{state.replace("_", " ")}</span>
        </p>

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Start date</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>End date</Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[1, 3, 6, 12].map((m) => (
              <Button
                key={m}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEnd(addMonths(end && new Date(end) > new Date() ? end : "", m))}
              >
                +{m} month{m > 1 ? "s" : ""}
              </Button>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => setEnd("")}>
              No expiry
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMPANY_STATUSES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Grace days</Label>
              <Input
                type="number"
                min={0}
                value={graceDays}
                onChange={(e) => setGraceDays(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

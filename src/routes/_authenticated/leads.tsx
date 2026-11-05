import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Inbox, MessageCircle, Phone, Plus, Repeat2, CalendarClock } from "lucide-react";
import { listInquiries, updateInquiry, submitInquiry, logFollowUp, type Inquiry } from "@/lib/api/inquiries";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, LEAD_STATUSES, LEAD_STATUS_LABEL, CUSTOMER_SOURCES, CUSTOMER_SOURCE_LABEL, type LeadStatus } from "@/lib/format";
import { openWhatsApp } from "@/lib/whatsapp";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({
    meta: [
      { title: "Leads & Inquiries | Ishan Detailing OS" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LeadsPage,
});

function LeadsPage() {
  const [filter, setFilter] = useState<LeadStatus | "all">("all");
  const qc = useQueryClient();
  const q = useQuery({ 
    queryKey: ["inquiries", filter], 
    queryFn: () => listInquiries(filter),
    retry: 1
  });

  const update = useMutation({
    mutationFn: (v: { id: string; patch: Partial<Inquiry> }) => updateInquiry(v.id, v.patch as never),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inquiries"] }); toast.success("Updated"); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Leads & Inquiries"
        subtitle="Website inquiries and walk-in / phone leads."
        actions={<NewLeadDialog onCreated={() => qc.invalidateQueries({ queryKey: ["inquiries"] })} />}
      />

      <div className="flex flex-wrap gap-2">
        {(["all", ...LEAD_STATUSES] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? "default" : "outline"}
            className="h-9"
            onClick={() => setFilter(s as any)}
          >
            {s === "all" ? "All" : LEAD_STATUS_LABEL[s as LeadStatus]}
          </Button>
        ))}
      </div>


      {q.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-[var(--radius)]" />)}
        </div>
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState icon={Inbox} title="No inquiries yet" description="Website inquiries will show up here as leads." />
      ) : (
        <div className="grid gap-3">
          {q.data!.map((lead) => <LeadCard key={lead.id} lead={lead} onUpdate={(patch) => update.mutate({ id: lead.id, patch })} />)}
        </div>
      )}
    </div>
  );
}

function LeadCard({ lead, onUpdate }: { lead: Inquiry; onUpdate: (patch: Partial<Inquiry>) => void }) {
  const [notes, setNotes] = useState(lead.notes ?? "");
  const qc = useQueryClient();
  const [nextDate, setNextDate] = useState("");
  const followUp = useMutation({
    mutationFn: () => logFollowUp(lead.id, nextDate ? new Date(nextDate).toISOString() : undefined),
    onSuccess: (count) => {
      setNextDate("");
      qc.invalidateQueries({ queryKey: ["inquiries"] });
      qc.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      toast.success(`Follow-up #${count} logged`);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });
  const count = Number(lead.follow_up_count ?? 0);
  const waMessage = `Hi ${lead.name.split(" ")[0]}, this is Workspace following up on your inquiry${lead.service ? ` about ${lead.service}` : ""}. When would be a good time to chat?`;
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-semibold tracking-tight">{lead.name}</div>
          <div className="text-sm text-muted-foreground">{lead.phone}{lead.vehicle ? ` · ${lead.vehicle}` : ""}</div>
          {lead.service && <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{lead.service}</div>}
          {lead.message && <p className="mt-2 text-sm">{lead.message}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{formatDateTime(lead.created_at)} · via {lead.source}</span>
            <Badge variant={count > 0 ? "secondary" : "outline"} className="gap-1">
              <Repeat2 className="h-3 w-3" />{count} follow-up{count === 1 ? "" : "s"}
            </Badge>
            {lead.last_follow_up_at && <span>last: {formatDateTime(lead.last_follow_up_at)}</span>}
            {lead.follow_up_at && (
              <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" />next: {formatDateTime(lead.follow_up_at)}</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={`tel:+91${lead.phone}`}><Button size="sm" variant="outline" className="h-9"><Phone className="mr-1 h-4 w-4" />Call</Button></a>
          <Button size="sm" className="h-9 bg-emerald-600 hover:bg-emerald-700" onClick={() => openWhatsApp(lead.phone, waMessage)}><MessageCircle className="mr-1 h-4 w-4" />WhatsApp</Button>
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">Internal notes</div>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => { if (notes !== (lead.notes ?? "")) onUpdate({ notes: notes || null } as never); }}
            rows={2}
            placeholder="Add a note about this lead"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={lead.status}
            onChange={(e) => onUpdate({ status: e.target.value as never, contacted_at: (e.target.value !== "new" && !lead.contacted_at) ? new Date().toISOString() : lead.contacted_at } as never)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>)}
          </select>
          <Input
            type="datetime-local"
            value={nextDate}
            onChange={(e) => setNextDate(e.target.value)}
            className="h-9 w-[195px]"
            aria-label="Next follow-up date"
          />
          <Button size="sm" variant="outline" className="h-9" disabled={followUp.isPending} onClick={() => followUp.mutate()}>
            <Repeat2 className="mr-1 h-4 w-4" />Log follow-up
          </Button>
        </div>
      </div>
    </Card>
  );
}

function NewLeadDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [service, setService] = useState("");
  const [source, setSource] = useState<string>("walk_in");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await submitInquiry({ name, phone, vehicle, service, message, source });
      toast.success("Lead added");
      setOpen(false);
      setName(""); setPhone(""); setVehicle(""); setService(""); setMessage(""); setSource("walk_in");
      onCreated();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to add lead");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-10"><Plus className="mr-2 h-4 w-4" /> New lead</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Register a new inquiry</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Vehicle</Label>
              <Input value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="e.g. Honda City / GJ01AB1234" />
            </div>
            <div className="space-y-1.5">
              <Label>Service interested</Label>
              <Input value={service} onChange={(e) => setService(e.target.value)} placeholder="Service name…" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Source</Label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {CUSTOMER_SOURCES.map((s) => <option key={s} value={s}>{CUSTOMER_SOURCE_LABEL[s]}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Notes / message</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="What did the customer say?" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !name.trim() || !phone.trim()}>
            {saving ? "Adding…" : "Add lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getJob, updateJobStatus, assignJobStaff, setExpectedDelivery, setDeliveryNotes, addJobNote } from "@/lib/api/jobs";
import { uploadMediaFile, listMediaForVehicle, signedMediaUrls } from "@/lib/api/media";
import { listStaff } from "@/lib/api/settings";
import { JOB_STATUSES, JOB_STATUS_LABEL, formatDateTime, formatINR } from "@/lib/format";
import { StatusBadge } from "./jobs";
import { toast } from "sonner";
import { Camera, Receipt, User, Calendar, MessageSquarePlus, Truck, MessageCircle } from "lucide-react";
import { openWhatsApp, readyMessage } from "@/lib/whatsapp";
import { useRoles } from "@/hooks/use-session";
import { DeliverDialog } from "@/components/deliver-dialog";
import { ActivityLog } from "@/components/activity-log";


export const Route = createFileRoute("/_authenticated/jobs/$id")({
  component: JobDetail,
});

function JobDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { canFinance } = useRoles();
  const jobQ = useQuery({ queryKey: ["job", id], queryFn: () => getJob(id) });
  const staffQ = useQuery({ queryKey: ["staff"], queryFn: listStaff });
  const mediaQ = useQuery({
    queryKey: ["media", jobQ.data?.vehicle_id],
    enabled: !!jobQ.data?.vehicle_id,
    queryFn: () => listMediaForVehicle(jobQ.data!.vehicle_id),
  });
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const paths = (mediaQ.data ?? []).map((m) => m.storage_path);
    if (paths.length) signedMediaUrls(paths).then(setUrls);
  }, [mediaQ.data]);

  const statusMut = useMutation({
    mutationFn: (s: string) => updateJobStatus(id, s as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["job", id] }); toast.success("Status updated"); },
    onError: (e: any) => toast.error(e.message),
  });

  const [deliverOpen, setDeliverOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<"pre_work" | "post_work">("post_work");
  const [busy, setBusy] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");

  const noteMut = useMutation({
    mutationFn: (n: string) => addJobNote(id, n),
    onSuccess: () => { setNoteDraft(""); qc.invalidateQueries({ queryKey: ["job", id] }); toast.success("Note added"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deliveryMut = useMutation({
    mutationFn: (n: string) => setDeliveryNotes(id, n),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["job", id] }); toast.success("Delivery notes saved"); },
    onError: (e: any) => toast.error(e.message),
  });


  async function onFiles(files: FileList | null) {
    if (!files || !jobQ.data) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        await uploadMediaFile({
          file,
          vehicle_id: jobQ.data.vehicle_id,
          customer_id: jobQ.data.customer_id,
          job_id: jobQ.data.id,
          stage,
        });
      }
      mediaQ.refetch();
      toast.success("Uploaded");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  if (jobQ.isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  const j = jobQ.data;
  if (!j) return <div>Not found</div>;

  const preMedia = (mediaQ.data ?? []).filter((m) => m.stage === "pre_work");
  const postMedia = (mediaQ.data ?? []).filter((m) => m.stage === "post_work");

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">{j.number}</div>
          <h1 className="text-2xl font-semibold tracking-tight">{j.vehicle?.number}</h1>
          <div className="text-sm text-muted-foreground">
            <Link to="/customers/$id" params={{ id: j.customer_id }} className="hover:underline">{j.customer?.name}</Link>
            {" · "}{j.customer?.phone}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={j.status} />
          {j.quote?.total != null && (
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground/70">
              Quote {formatINR(j.quote.total)}
            </span>
          )}
        </div>
      </div>

      <Card className="p-4">
        <div className="mb-2 text-xs font-medium text-muted-foreground">STATUS</div>
        <div className="flex flex-wrap gap-2">
          {JOB_STATUSES.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={j.status === s ? "default" : "secondary"}
              disabled={statusMut.isPending}
              onClick={() => {
                if (s === "delivered" && j.status !== "delivered") { setDeliverOpen(true); return; }
                statusMut.mutate(s);
              }}
            >
              {JOB_STATUS_LABEL[s]}
            </Button>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground"><User className="h-3 w-3" /> ASSIGNED STAFF</div>
          <div className="space-y-1">
            {(staffQ.data ?? []).map((s) => {
              const on = (j.assigned_to as string[])?.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    const list = new Set(j.assigned_to as string[]);
                    if (on) list.delete(s.id); else list.add(s.id);
                    assignJobStaff(j.id, [...list]).then(() => qc.invalidateQueries({ queryKey: ["job", id] }));
                  }}
                  className={`flex w-full items-center justify-between rounded-lg border p-2 text-sm ${on ? "border-primary bg-primary/5" : ""}`}
                >
                  <span>{s.full_name ?? "—"}</span>
                  {on && <span className="text-xs text-primary">Assigned</span>}
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground"><Calendar className="h-3 w-3" /> EXPECTED DELIVERY</div>
          <Input
            type="datetime-local"
            defaultValue={j.expected_delivery ? new Date(j.expected_delivery).toISOString().slice(0, 16) : ""}
            onBlur={(e) => {
              const iso = e.target.value ? new Date(e.target.value).toISOString() : null;
              setExpectedDelivery(j.id, iso).then(() => qc.invalidateQueries({ queryKey: ["job", id] }));
            }}
          />
          {j.quote && (
            <div className="pt-3 text-sm">
              <div className="text-xs text-muted-foreground">Quote total</div>
              <div className="text-lg font-semibold">{formatINR(j.quote.total)}</div>
              <Link to="/quotes/$id" params={{ id: j.quote.id }} className="text-xs text-muted-foreground hover:underline">View quote {j.quote.number} →</Link>
            </div>
          )}
        </Card>
      </div>

      {canFinance && j.status !== "delivered" && (
        <div className="space-y-2">
          {j.quote && (
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <div className="text-xs text-muted-foreground">
                Approved quote{j.quote.number ? ` · ${j.quote.number}` : ""}
              </div>
              <div className="font-semibold tabular-nums">{formatINR(Number(j.quote.total))}</div>
            </div>
          )}
          <Button size="lg" className="w-full h-12" onClick={() => setDeliverOpen(true)}>
            <Receipt className="mr-2 h-4 w-4" /> Complete · Invoice · Payment
            {j.quote?.total != null && (
              <span className="ml-2 rounded-full bg-primary-foreground/15 px-2 py-0.5 text-xs font-medium">
                {formatINR(Number(j.quote.total))}
              </span>
            )}
          </Button>
          {j.status === "ready" && j.customer?.phone && j.vehicle?.number && (
            <Button
              variant="outline"
              className="mt-2 w-full h-11 border-emerald-500 text-emerald-700 hover:bg-emerald-50"
              onClick={() => openWhatsApp(j.customer!.phone, readyMessage({
                customerName: j.customer!.name,
                vehicle: j.vehicle!.number,
                jobNumber: j.number,
                jobId: id,
              }))}
            >
              <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp: Vehicle ready
            </Button>
          )}
        </div>
      )}

      <DeliverDialog
        open={deliverOpen}
        onOpenChange={setDeliverOpen}
        jobId={id}
        vehicleLabel={j.vehicle?.number}
        quoteTotal={j.quote?.total ? Number(j.quote.total) : undefined}
        quote={j.quote}
        customer={j.customer}
        vehicle={j.vehicle}
        onDone={() => qc.invalidateQueries({ queryKey: ["job", id] })}
      />


      <input ref={inputRef} type="file" accept="image/*,video/*" capture="environment" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
      <div className="grid gap-4 md:grid-cols-2">
        <MediaSectionCard
          title="Pre-work photos"
          subtitle={`${preMedia.length} item${preMedia.length === 1 ? "" : "s"} · before service`}
          media={preMedia}
          urls={urls}
          busy={busy}
          onAdd={() => { setStage("pre_work"); setTimeout(() => inputRef.current?.click(), 0); }}
        />
        <MediaSectionCard
          title="Post-work photos"
          subtitle={`${postMedia.length} item${postMedia.length === 1 ? "" : "s"} · after service`}
          media={postMedia}
          urls={urls}
          busy={busy}
          onAdd={() => { setStage("post_work"); setTimeout(() => inputRef.current?.click(), 0); }}
        />
      </div>

      {(j.status === "ready" || j.status === "delivered") && (
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Truck className="h-3 w-3" /> DELIVERY NOTES</div>
          <Textarea
            defaultValue={j.delivery_notes ?? ""}
            placeholder="Handover notes, condition on delivery, customer remarks…"
            rows={3}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (j.delivery_notes ?? "")) deliveryMut.mutate(v);
            }}
          />
        </Card>
      )}

      <Card className="p-4">
        <div className="mb-2 text-xs font-medium text-muted-foreground">STATUS TIMELINE</div>
        <ol className="space-y-2 text-sm">
          {(j.events ?? []).slice().sort((a: any, b: any) => a.created_at.localeCompare(b.created_at)).map((e: any) => (
            <li key={e.id} className="border-l-2 border-primary/30 pl-3">
              <div className="flex justify-between gap-2">
                <span className="font-medium">
                  {e.status ? JOB_STATUS_LABEL[e.status as keyof typeof JOB_STATUS_LABEL] : "Note"}
                </span>
                <span className="text-xs text-muted-foreground">{formatDateTime(e.created_at)}</span>
              </div>
              {e.note && <div className="mt-0.5 text-muted-foreground">{e.note}</div>}
            </li>
          ))}
        </ol>
        <div className="mt-3 flex gap-2">
          <Input
            placeholder="Add a note to the log…"
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && noteDraft.trim()) noteMut.mutate(noteDraft.trim()); }}
          />
          <Button
            size="sm"
            disabled={!noteDraft.trim() || noteMut.isPending}
            onClick={() => noteMut.mutate(noteDraft.trim())}
          >
            <MessageSquarePlus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>
      </Card>

      
    </div>

  );
}


function MediaSectionCard({ title, subtitle, media, urls, busy, onAdd }: { title: string; subtitle: string; media: any[]; urls: Record<string, string>; busy: boolean; onAdd: () => void }) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-medium text-muted-foreground">{title.toUpperCase()}</div>
          <div className="text-sm">{subtitle}</div>
        </div>
        <Button size="sm" onClick={onAdd} disabled={busy}>
          <Camera className="mr-1 h-4 w-4" /> Add
        </Button>
      </div>
      {media.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
          No {title.toLowerCase()} yet
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {media.map((m) => {
            const url = urls[m.storage_path];
            return (
              <a key={m.id} href={url} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-lg bg-muted">
                {url && m.kind === "photo" ? (
                  <img src={url} className="h-full w-full object-cover" alt="" />
                ) : url && m.kind === "video" ? (
                  <video src={url} className="h-full w-full object-cover" />
                ) : null}
              </a>
            );
          })}
        </div>
      )}
    </Card>
  );
}

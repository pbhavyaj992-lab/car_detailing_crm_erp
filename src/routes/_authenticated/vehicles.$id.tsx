import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getVehicle } from "@/lib/api/vehicles";
import { listMediaForVehicle, signedMediaUrls, type MediaRow } from "@/lib/api/media";
import { formatDateTime, JOB_STATUS_LABEL } from "@/lib/format";
import { ActivityLog } from "@/components/activity-log";

export const Route = createFileRoute("/_authenticated/vehicles/$id")({
  component: VehicleDetail,
});

function VehicleDetail() {
  const { id } = Route.useParams();
  const vehicle = useQuery({ queryKey: ["vehicle", id], queryFn: () => getVehicle(id) });
  const media = useQuery({ queryKey: ["vehicle-media", id], queryFn: () => listMediaForVehicle(id) });
  const jobs = useQuery({
    queryKey: ["vehicle-jobs", id],
    queryFn: async () => (await supabase.from("jobs").select("*").eq("vehicle_id", id).order("created_at", { ascending: false })).data ?? [],
  });
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const paths = (media.data ?? []).map((m) => m.storage_path);
    if (paths.length) signedMediaUrls(paths).then(setUrls);
  }, [media.data]);

  const v = vehicle.data;
  if (!v) return (
    <div className="space-y-3">
      <Skeleton className="h-24 w-full rounded-[var(--radius)]" />
      <Skeleton className="h-40 w-full rounded-[var(--radius)]" />
    </div>
  );

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h1 className="text-2xl font-semibold tracking-tight">{v.number}</h1>
        <div className="text-sm text-muted-foreground">
          {[v.brand, v.model, v.color, v.fuel_type].filter(Boolean).join(" · ") || "—"}
        </div>
        {v.customer && (
          <Link to="/customers/$id" params={{ id: v.customer.id }} className="mt-2 inline-block text-sm text-primary hover:underline">
            Owner: {v.customer.name}
          </Link>
        )}
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Timeline</h2>
        <Card className="p-3">
          <ol className="space-y-2 text-sm">
            {(jobs.data ?? []).map((j: any) => (
              <li key={j.id} className="flex justify-between border-l-2 border-primary/30 pl-3">
                <Link to="/jobs/$id" params={{ id: j.id }} className="hover:underline">Job {j.number} · {JOB_STATUS_LABEL[j.status as keyof typeof JOB_STATUS_LABEL]}</Link>
                <span className="text-muted-foreground">{formatDateTime(j.created_at)}</span>
              </li>
            ))}
            {(media.data ?? []).slice(0, 20).map((m) => (
              <li key={m.id} className="flex justify-between border-l-2 border-primary/30 pl-3">
                <span>{m.stage === "pre_work" ? "Pre-work" : "Post-work"} media</span>
                <span className="text-muted-foreground">{formatDateTime(m.created_at)}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <MediaSection title="Pre-work" media={(media.data ?? []).filter((m) => m.stage === "pre_work")} urls={urls} />
      <MediaSection title="Post-work" media={(media.data ?? []).filter((m) => m.stage === "post_work")} urls={urls} />

      
    </div>

  );
}

function MediaSection({ title, media, urls }: { title: string; media: MediaRow[]; urls: Record<string, string> }) {
  if (!media.length) return null;
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {media.map((m) => {
          const url = urls[m.storage_path];
          return (
            <a
              key={m.id}
              href={url}
              target="_blank"
              rel="noreferrer"
              aria-label={`${title} media ${formatDateTime(m.created_at)}`}
              className="aspect-square overflow-hidden rounded-lg bg-muted"
            >
              {url && m.kind === "photo" ? <img src={url} className="h-full w-full object-cover" alt="" />
              : url && m.kind === "video" ? <video src={url} className="h-full w-full object-cover" /> : null}
            </a>
          );
        })}
      </div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { signedMediaUrls } from "@/lib/api/media";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Images } from "lucide-react";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/gallery")({
  head: () => ({ meta: [{ title: "Media Gallery | Ishan Detailing OS" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: GalleryPage,
});

type Row = {
  id: string;
  vehicle_id: string;
  job_id: string | null;
  stage: "pre_work" | "post_work";
  kind: "photo" | "video";
  storage_path: string;
  created_at: string;
  vehicles: { number: string | null; brand: string | null; model: string | null } | null;
};

function GalleryPage() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["gallery-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media")
        .select("id, vehicle_id, job_id, stage, kind, storage_path, created_at, vehicles(number, brand, model)")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const paths = useMemo(() => rows.map((r) => r.storage_path), [rows]);
  const { data: urls = {} } = useQuery({
    queryKey: ["gallery-urls", paths],
    queryFn: () => signedMediaUrls(paths),
    enabled: paths.length > 0,
  });

  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      const key = r.vehicle_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries());
  }, [rows]);

  return (
    <div className="space-y-6">
      <PageHeader title="Media Gallery" subtitle="Pre-work & post-work photos across all vehicles." />

      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-[var(--radius)]" />
          ))}
        </div>
      )}
      {!isLoading && rows.length === 0 && (
        <EmptyState icon={Images} title="No media yet" description="Photos uploaded during jobs will appear here." />
      )}

      <div className="space-y-6">
        {groups.map(([vid, items]) => {
          const v = items[0].vehicles;
          const pre = items.filter((i) => i.stage === "pre_work");
          const post = items.filter((i) => i.stage === "post_work");
          return (
            <Card key={vid} className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <Link to="/vehicles/$id" params={{ id: vid }} className="font-medium hover:underline">
                  {v?.number ?? "Vehicle"} · {[v?.brand, v?.model].filter(Boolean).join(" ")}
                </Link>
                <span className="text-xs text-muted-foreground">{items.length} items</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <StageGrid title="Pre-work" tone="muted" items={pre} urls={urls} />
                <StageGrid title="Post-work" tone="primary" items={post} urls={urls} />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function StageGrid({
  title,
  tone,
  items,
  urls,
}: {
  title: string;
  tone: "muted" | "primary";
  items: Row[];
  urls: Record<string, string>;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Badge variant={tone === "primary" ? "default" : "secondary"}>{title}</Badge>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          No {title.toLowerCase()} photos
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {items.map((m) => {
            const url = urls[m.storage_path];
            return (
              <a
                key={m.id}
                href={url ?? "#"}
                target="_blank"
                rel="noreferrer"
                aria-label={`${title} media ${formatDate(m.created_at)}`}
                className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
                title={formatDate(m.created_at)}
              >
                {url ? (
                  m.kind === "video" ? (
                    <video src={url} className="h-full w-full object-cover" />
                  ) : (
                    <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  )
                ) : (
                  <div className="grid h-full place-items-center text-[10px] text-muted-foreground">…</div>
                )}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

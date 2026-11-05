import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getSettings } from "@/lib/api/settings";
import { supabase } from "@/integrations/supabase/client";
import { LogoThumb } from "./logo-upload";

export function PrintHeader({ title, number, date }: { title: string; number?: string; date?: string }) {
  const s = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const b = s.data;
  const company = useQuery({ 
    queryKey: ["my-company-logo"], 
    queryFn: () => supabase.from("companies" as any).select("logo_url, name").limit(1).maybeSingle().then((r: { data: any }) => r.data) 
  });
  const logoUrl = company.data?.logo_url;

  return (
    <div className="print-only mb-6 border-b pb-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-20 w-20 overflow-hidden rounded-lg bg-gray-50 p-1 flex items-center justify-center border border-gray-100">
            <LogoThumb value={logoUrl} name={b?.business_name} className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="text-xl font-bold">{b?.business_name ?? "Business"}</div>
            {b?.address && <div className="text-xs whitespace-pre-line">{b.address}</div>}
            <div className="text-xs">
              {b?.phone && <>Ph: {b.phone} </>}
              {b?.email && <>· {b.email} </>}
              {b?.gstin && <>· GSTIN: {b.gstin}</>}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold uppercase">{title}</div>
          {number && <div className="text-sm">{number}</div>}
          {date && <div className="text-xs">{date}</div>}
        </div>
      </div>
    </div>
  );
}

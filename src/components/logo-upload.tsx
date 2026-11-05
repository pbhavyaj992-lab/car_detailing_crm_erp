import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Upload, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { resolveLogoUrl, uploadCompanyLogo } from "@/lib/api/company-logo";

type Props = {
  value?: string | null;
  onChange: (value: string) => void;
  slug?: string;
  label?: string;
};

export function LogoUpload({ value, onChange, slug = "company", label = "Logo" }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isPdf = !!value && value.toLowerCase().endsWith(".pdf");

  useEffect(() => {
    let alive = true;
    resolveLogoUrl(value).then((u) => alive && setPreview(u));
    return () => {
      alive = false;
    };
  }, [value]);

  async function handleFile(file?: File | null) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File must be under 5 MB");
      return;
    }
    setBusy(true);
    try {
      const ref = await uploadCompanyLogo(file, slug);
      onChange(ref);
      toast.success("Logo uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-secondary">
          {isPdf ? (
            <FileText className="h-5 w-5 text-muted-foreground" />
          ) : preview ? (
            <img src={preview} alt="Business logo" className="h-full w-full object-cover" />
          ) : (
            <Building2 className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            {busy ? "Uploading…" : value ? "Replace" : "Upload image / PDF"}
          </Button>
          {value ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
              <X className="mr-1 h-4 w-4" /> Remove
            </Button>
          ) : null}
        </div>
      </div>
      <Input
        className="mt-1"
        placeholder="…or paste an image URL"
        value={value?.startsWith("storage:") ? "" : value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/** Small read-only logo tile that resolves stored references to signed URLs. */
export function LogoThumb({ value, name, className = "h-8 w-8" }: { value?: string | null; name?: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    resolveLogoUrl(value).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [value]);
  if (!url || value?.toLowerCase().endsWith(".pdf")) {
    return (
      <div className={`grid shrink-0 place-items-center rounded-lg bg-secondary ${className}`}>
        {name ? (
          <span className="text-[10px] font-bold uppercase text-muted-foreground/60">
            {name.substring(0, 2)}
          </span>
        ) : (
          <Building2 className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
    );
  }
  return <img src={url} alt={`${name ?? "Business"} logo`} className={`shrink-0 rounded-lg object-contain ${className}`} />;
}

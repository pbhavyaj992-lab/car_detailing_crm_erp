// Centralized PDF and print flow for quotes and invoices.
// PDFs are built programmatically (see pdf-document.ts) — no DOM snapshot,
// so the output is consistent regardless of Tailwind / CSS.
import { useEffect, useRef, useState } from "react";
import type { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

const LOG = (...a: any[]) => console.log("[print]", ...a);

export const PRINT_SEARCH = { print: 1 } as const;

export function hasPrintFlag(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("print") === "1";
}

type Navigate = ReturnType<typeof useNavigate>;

export function openQuoteForDownload(navigate: Navigate, id: string) {
  navigate({ to: "/quotes/$id", params: { id }, search: PRINT_SEARCH as any });
}
export function openInvoiceForDownload(navigate: Navigate, id: string) {
  navigate({ to: "/invoices/$id", params: { id }, search: PRINT_SEARCH as any });
}
export function hardOpenInvoiceForDownload(id: string) {
  if (typeof window === "undefined") return;
  window.location.href = `/invoices/${id}?print=1`;
}

/** Runs the async blob builder and streams the file to the user. */
export async function runPdfDownload(
  build: () => Promise<Blob>,
  filename: string,
): Promise<boolean> {
  const safe = `${filename.replace(/[^a-zA-Z0-9._-]/g, "-")}.pdf`;
  const toastId = toast.loading(`Generating ${safe}…`);
  LOG("PDF generation started", { filename: safe });
  try {
    const blob = await build();
    const { downloadBlob } = await import("@/lib/pdf-document");
    downloadBlob(blob, safe);
    toast.success(`${safe} downloaded`, { id: toastId });
    LOG("PDF downloaded", { filename: safe, size: blob.size });
    return true;
  } catch (error) {
    console.error("[print] PDF generation failed", error);
    toast.error("PDF generation failed. Please try again.", { id: toastId });
    return false;
  }
}

export function printCurrentDocument(title: string): boolean {
  if (typeof window === "undefined") return false;
  const previousTitle = document.title;
  document.title = title;
  const restoreTitle = () => { document.title = previousTitle; };
  window.addEventListener("afterprint", restoreTitle, { once: true });
  window.setTimeout(restoreTitle, 30_000);
  window.print();
  return true;
}

/**
 * Watches for ?print=1 and triggers a direct PDF download once data is ready.
 * Returns `{ blocked, retry }` so a failed generation can be retried manually.
 */
export function useAutoPrintDownload(
  ready: boolean,
  download: () => Promise<boolean> | boolean | void,
  printActive: boolean = hasPrintFlag(),
) {
  const firedRef = useRef(false);
  const [blocked, setBlocked] = useState(false);

  // Reset guard when the print flag turns off, so a later navigation that
  // re-adds ?print=1 will fire again.
  useEffect(() => {
    if (!printActive) {
      firedRef.current = false;
      setBlocked(false);
    }
  }, [printActive]);

  useEffect(() => {
    LOG("hook effect", { ready, printActive, fired: firedRef.current });
    if (!ready || !printActive || firedRef.current) return;
    firedRef.current = true;
    const run = async () => {
      await new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      );
      LOG("auto-download: invoking handler");
      try {
        const res = await download();
        LOG("auto-download handler result", res);
        if (res === false) setBlocked(true);
      } catch (e) {
        LOG("auto-print handler threw", e);
        setBlocked(true);
      }
    };
    void run();
  }, [ready, printActive]); // eslint-disable-line react-hooks/exhaustive-deps

  const retry = async () => {
    setBlocked(false);
    LOG("manual retry: invoking download handler");
    const res = await download();
    LOG("manual retry result", res);
    if (res === false) setBlocked(true);
  };

  return { blocked, retry };
}

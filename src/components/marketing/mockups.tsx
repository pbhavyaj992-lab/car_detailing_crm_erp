import { cn } from "@/lib/utils";

/* On-brand product mockups rendered in DOM so they stay crisp at any resolution.
   Premium SaaS language: hairline borders, neutral surfaces, small radius,
   dense-but-calm typography, minimal shadow. */

type Tone = "light" | "dark";

export function Frame({
  label,
  children,
  className,
  tone = "light",
  chrome = true,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  tone?: Tone;
  chrome?: boolean;
}) {
  const dark = tone === "dark";
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[10px] border",
        dark ? "border-deep-line/70 bg-deep-alt" : "border-hairline bg-surface",
        className,
      )}
    >
      {chrome && (
        <div
          className={cn(
            "flex items-center gap-1.5 border-b px-3.5 py-2",
            dark ? "border-deep-line/70 bg-white/[0.02]" : "border-hairline bg-canvas/60",
          )}
        >
          <span
            className={cn("h-[6px] w-[6px] rounded-full", dark ? "bg-white/20" : "bg-ink/15")}
          />
          <span
            className={cn("h-[6px] w-[6px] rounded-full", dark ? "bg-white/20" : "bg-ink/15")}
          />
          <span
            className={cn("h-[6px] w-[6px] rounded-full", dark ? "bg-white/20" : "bg-ink/15")}
          />
          <span
            className={cn(
              "ml-2.5 truncate text-[11px] font-medium tracking-[0.02em]",
              dark ? "text-white/45" : "text-ink-faint",
            )}
          >
            {label}
          </span>
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

function Row({ left, right, muted }: { left: string; right?: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-[7px]">
      <span className={cn("text-[13px]", muted ? "text-ink-soft" : "text-ink")}>{left}</span>
      {right && (
        <span
          className={cn(
            "text-[13px] tabular-nums",
            muted ? "text-ink-soft" : "font-medium text-ink",
          )}
        >
          {right}
        </span>
      )}
    </div>
  );
}

export function LeadMock() {
  return (
    <Frame label="Enquiry">
      <div className="space-y-3">
        <div>
          <div className="eyebrow text-ink-faint">New enquiry</div>
          <div className="mt-2 text-[17px] font-semibold tracking-[-0.01em] text-ink">
            Rohan Mehta
          </div>
          <div className="mt-0.5 text-[13px] text-ink-soft">Audi Q5 · GJ 01 KH 4412</div>
        </div>
        <div className="h-px bg-hairline" />
        <div className="-my-1">
          <Row left="Interested in" right="Ceramic coating" />
          <Row left="Source" right="Instagram" muted />
          <Row left="Follow-ups" right="2" muted />
        </div>
        <div className="pt-1">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-copper/10 px-2 py-1 text-[11px] font-medium text-copper">
            <span className="h-1.5 w-1.5 rounded-full bg-copper" />
            Hot lead
          </span>
        </div>
      </div>
    </Frame>
  );
}

export function QuoteMock() {
  return (
    <Frame label="Quote #0241">
      <div className="-mt-1">
        <Row left="9H ceramic coating" right="₹28,000" />
        <Row left="Paint correction — 2 step" right="₹12,500" />
        <Row left="Interior deep clean" right="₹4,000" />
        <div className="my-2.5 h-px bg-hairline" />
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] text-ink-soft">Total</span>
          <span className="text-xl font-semibold tabular-nums tracking-[-0.02em] text-ink">
            ₹44,500
          </span>
        </div>
        <div className="pt-4">
          <div className="inline-flex rounded-md bg-ink px-3 py-1.5 text-[11px] font-medium text-canvas">
            Send to customer
          </div>
        </div>
      </div>
    </Frame>
  );
}

const bays = [
  { stage: "Received", car: "Fortuner", plate: "MH 12 AB 9021", tone: "faint" },
  { stage: "In progress", car: "Audi Q5", plate: "GJ 01 KH 4412", tone: "copper" },
  { stage: "Quality check", car: "Thar", plate: "DL 8C 7741", tone: "faint" },
  { stage: "Ready", car: "City", plate: "KA 05 MJ 3390", tone: "ink" },
];

export function BayBoardMock({ compact = false }: { compact?: boolean }) {
  return (
    <Frame label="Bay board — live">
      <div className={cn("grid gap-2.5", compact ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4")}>
        {bays.map((b) => (
          <div
            key={b.plate}
            className="rounded-lg border border-hairline bg-canvas/40 p-3 transition-colors duration-200 hover:border-hairline-strong"
          >
            <div
              className={cn(
                "text-[10px] font-medium uppercase tracking-[0.14em]",
                b.tone === "copper" ? "text-copper" : "text-ink-faint",
              )}
            >
              {b.stage}
            </div>
            <div className="mt-2.5 text-[13px] font-semibold tracking-[-0.01em] text-ink">
              {b.car}
            </div>
            <div className="mt-0.5 text-[11px] tabular-nums text-ink-soft">{b.plate}</div>
            <div className="mt-3.5 h-[3px] w-full rounded-full bg-ink/[0.07]">
              <div
                className={cn(
                  "h-[3px] rounded-full",
                  b.tone === "copper" ? "bg-copper" : "bg-ink/30",
                )}
                style={{
                  width:
                    b.stage === "Received"
                      ? "18%"
                      : b.stage === "In progress"
                        ? "62%"
                        : b.stage === "Quality check"
                          ? "84%"
                          : "100%",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function InvoiceMock() {
  return (
    <Frame label="Invoice #INV-0198">
      <div className="-mt-1">
        <Row left="Subtotal" right="₹44,500" muted />
        <Row left="Discount" right="− ₹1,500" muted />
        <div className="my-2.5 h-px bg-hairline" />
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] text-ink-soft">Paid</span>
          <span className="text-xl font-semibold tabular-nums tracking-[-0.02em] text-ink">
            ₹43,000
          </span>
        </div>
        <div className="flex items-baseline justify-between pt-1">
          <span className="text-[13px] text-ink-soft">Rounding adjusted</span>
          <span className="text-[13px] tabular-nums text-ink-soft">₹0</span>
        </div>
        <div className="pt-4">
          <span className="inline-flex rounded-md border border-hairline px-2 py-1 text-[11px] font-medium text-ink-soft">
            Settled · PDF sent on WhatsApp
          </span>
        </div>
      </div>
    </Frame>
  );
}

const barHeights = [38, 52, 44, 70, 61, 88, 76, 96, 84, 100, 92, 78];

const analyticsStats = [
  { label: "Revenue", value: "₹8,42,000" },
  { label: "Cars delivered", value: "64" },
  { label: "Outstanding", value: "₹36,500" },
];

export function AnalyticsMock({ tone = "light" }: { tone?: Tone }) {
  const dark = tone === "dark";
  return (
    <Frame label="Studio overview — this month" tone={tone}>
      <div className={cn("grid sm:grid-cols-3", dark ? "divide-deep-line/60" : "divide-hairline")}>
        {analyticsStats.map((s, i) => (
          <div
            key={s.label}
            className={cn(
              "py-1 text-left",
              i > 0 && "mt-6 sm:mt-0 sm:border-l sm:pl-6",
              i > 0 && (dark ? "sm:border-deep-line/60" : "sm:border-hairline"),
            )}
          >
            <div className={cn("eyebrow", dark ? "text-white/40" : "text-ink-faint")}>
              {s.label}
            </div>
            <div
              className={cn(
                "mt-2.5 text-[26px] font-semibold tabular-nums tracking-[-0.03em]",
                dark ? "text-white" : "text-ink",
              )}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>

      <div
        className={cn(
          "mt-8 border-t pt-6",
          dark ? "border-deep-line/60" : "border-hairline",
        )}
      >
        <div className="flex h-36 items-end gap-1.5 sm:gap-2">
          {barHeights.map((h, i) => (
            <div
              key={i}
              className={cn(
                "flex-1 rounded-[2px]",
                i === 9 ? "bg-copper" : dark ? "bg-white/12" : "bg-ink/[0.09]",
              )}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div
          className={cn(
            "mt-3 flex justify-between text-[10px] uppercase tracking-[0.14em]",
            dark ? "text-white/35" : "text-ink-faint",
          )}
        >
          <span>Week 1</span>
          <span>Week 4</span>
        </div>
      </div>
    </Frame>
  );
}

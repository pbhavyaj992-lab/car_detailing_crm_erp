import {
  Sparkles,
  Car,
  FileText,
  Wrench,
  Receipt,
  Users,
  Camera,
  BarChart3,
  History,
} from "lucide-react";
import { Reveal } from "./reveal";

const capabilities = [
  { icon: Sparkles, title: "Lead management", body: "Capture every enquiry, assign follow-ups and convert leads into customers." },
  { icon: Car, title: "Customer & vehicle history", body: "One record per customer and registration — every visit, job and invoice." },
  { icon: FileText, title: "Smart quotes", body: "Build quotes from your service list, apply discounts and tax, share instantly." },
  { icon: Wrench, title: "Job management", body: "Track every car from received to inspection, work, quality check and delivery." },
  { icon: Receipt, title: "Invoices & payments", body: "Invoice straight from the job, record cash, UPI, card or bank payments." },
  { icon: Users, title: "Staff & roles", body: "Owners, managers, reception and workers each see exactly what they should." },
  { icon: Camera, title: "Before & after photos", body: "Pre-work and post-work media attached to the vehicle and the job." },
  { icon: BarChart3, title: "Analytics & revenue", body: "Collected revenue, outstanding balances and job throughput at a glance." },
  { icon: History, title: "Activity tracking", body: "A full audit trail of who changed what, and when, across your business." },
];

export function Capabilities() {
  return (
    <section id="capabilities" className="border-t border-hairline bg-surface">
      <div className="container-page py-24 sm:py-32">
        <Reveal>
          <div className="eyebrow text-ink-faint">What you get</div>
          <h2 className="mt-5 max-w-[22ch] text-[1.85rem] font-semibold leading-[1.14] tracking-[-0.03em] text-ink sm:text-[2.5rem]">
            Everything your workshop runs on, in one platform.
          </h2>
        </Reveal>

        <div className="mt-14 grid border-l border-t border-hairline sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((c, i) => (
            <Reveal key={c.title} delay={(i % 3) * 60}>
              <div className="group h-full border-b border-r border-hairline p-7 transition-colors duration-200 hover:bg-canvas/60">
                <c.icon
                  className="h-[18px] w-[18px] text-ink-faint transition-colors duration-200 group-hover:text-copper"
                  strokeWidth={1.75}
                />
                <h3 className="mt-5 text-[15px] font-semibold tracking-[-0.01em] text-ink">
                  {c.title}
                </h3>
                <p className="mt-2 max-w-[38ch] text-[13.5px] leading-relaxed text-ink-soft">
                  {c.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

import { Reveal } from "./reveal";

const before = [
  "Enquiries lost in WhatsApp scroll",
  "Quotes typed out fresh every time",
  "Job status only in someone's head",
  "Payments reconciled from memory",
];

const after = [
  "Every enquiry captured with the car",
  "Quotes built from your service list",
  "Bay board shows every car, live",
  "Invoices, part-payments and expenses tracked",
];

export function ProblemSolution() {
  return (
    <section className="container-page py-24 sm:py-32">
      <Reveal>
        <h2 className="max-w-[20ch] text-[1.85rem] font-semibold leading-[1.14] tracking-[-0.03em] text-ink sm:text-[2.5rem]">
          Most studios run on three tools that don&rsquo;t talk to each other.
        </h2>
      </Reveal>

      <div className="mt-14 grid overflow-hidden rounded-xl border border-hairline bg-surface md:grid-cols-2">
        <Reveal delay={70} className="border-b border-hairline p-7 md:border-b-0 md:border-r sm:p-9">
          <div className="eyebrow text-ink-faint">Today</div>
          <ul className="mt-6 space-y-4">
            {before.map((b) => (
              <li key={b} className="flex gap-3.5 text-[15px] leading-relaxed text-ink-soft">
                <span className="mt-[11px] h-px w-3.5 shrink-0 bg-ink-faint" />
                {b}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={140} className="bg-canvas/50 p-7 sm:p-9">
          <div className="eyebrow text-copper">With Ishan</div>
          <ul className="mt-6 space-y-4">
            {after.map((a) => (
              <li key={a} className="flex gap-3.5 text-[15px] leading-relaxed text-ink">
                <span className="mt-[11px] h-px w-3.5 shrink-0 bg-copper" />
                {a}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

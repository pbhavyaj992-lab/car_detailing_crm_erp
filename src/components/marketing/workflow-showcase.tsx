import { Reveal } from "./reveal";
import { LeadMock, QuoteMock, BayBoardMock, InvoiceMock } from "./mockups";

const steps = [
  {
    n: "01",
    title: "Lead comes in",
    caption:
      "Captured with the vehicle, the source and what they're after — never buried in a chat thread.",
    mock: <LeadMock />,
  },
  {
    n: "02",
    title: "Quote goes out",
    caption:
      "Built from your service list in seconds, sent as a link, tracked until it's accepted.",
    mock: <QuoteMock />,
  },
  {
    n: "03",
    title: "Car hits the bay",
    caption: "Live status on the board. Every detailer sees the same truth, in real time.",
    mock: <BayBoardMock compact />,
  },
  {
    n: "04",
    title: "Invoice gets paid",
    caption:
      "Generated straight from the quote. Part-payments and outstanding balances tracked automatically.",
    mock: <InvoiceMock />,
  },
];

export function WorkflowShowcase() {
  return (
    <section id="workflow" className="border-t border-hairline bg-canvas-alt/60">
      <div className="container-page py-24 sm:py-32">
        <Reveal>
          <div className="eyebrow text-ink-faint">The workflow</div>
          <h2 className="mt-5 max-w-[20ch] text-[1.85rem] font-semibold leading-[1.14] tracking-[-0.03em] text-ink sm:text-[2.5rem]">
            One connected flow, from first message to paid invoice.
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {steps.map((step, i) => (
            <Reveal key={step.n} delay={i * 80} className="group">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-medium tabular-nums tracking-[0.14em] text-copper">
                  {step.n}
                </span>
                <span className="h-px flex-1 bg-hairline" />
              </div>
              <h3 className="mt-4 text-[15px] font-semibold tracking-[-0.01em] text-ink">
                {step.title}
              </h3>
              <p className="mt-2 max-w-[36ch] text-[13.5px] leading-relaxed text-ink-soft">
                {step.caption}
              </p>
              <div className="mt-6 transition-transform duration-300 group-hover:-translate-y-[3px]">
                <div className="rounded-xl bg-surface shadow-soft transition-shadow duration-300 group-hover:shadow-lift">
                  {step.mock}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

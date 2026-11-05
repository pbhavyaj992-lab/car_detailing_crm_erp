import { Reveal } from "./reveal";
import { AnalyticsMock } from "./mockups";

export function AnalyticsProof() {
  return (
    <section id="insights" className="bg-deep py-24 sm:py-32">
      <div className="container-page">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <div className="eyebrow text-white/40">Insights</div>
            <h2 className="mx-auto mt-5 max-w-[20ch] text-[1.85rem] font-semibold leading-[1.14] tracking-[-0.03em] text-white sm:text-[2.5rem]">
              Know how the studio is doing, without asking anyone.
            </h2>
          </Reveal>
        </div>

        <Reveal delay={110} className="mx-auto mt-14 max-w-4xl">
          <div className="rounded-2xl border border-deep-line/50 bg-white/[0.02] p-1.5 sm:p-2">
            <AnalyticsMock tone="dark" />
          </div>
        </Reveal>

        <Reveal delay={180}>
          <p className="mx-auto mt-7 max-w-[52ch] text-center text-[13.5px] leading-relaxed text-white/50">
            Revenue, deliveries and outstanding balances, updated as jobs move.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

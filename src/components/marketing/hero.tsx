import { Link } from "@tanstack/react-router";
import { Reveal } from "./reveal";
import { BayBoardMock } from "./mockups";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Very subtle vertical wash — no colorful gradients */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b from-surface to-transparent"
      />

      <div className="container-page relative pb-20 pt-14 sm:pb-24 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="eyebrow text-ink-faint">
              Car detailing CRM for detailing, PPF &amp; ceramic coating studios
            </p>
          </Reveal>

          <Reveal delay={70}>
            <h1 className="mx-auto mt-6 max-w-[18ch] text-[2.6rem] font-semibold leading-[1.04] tracking-[-0.035em] text-ink sm:text-[3.5rem] lg:text-[4rem]">
              The car detailing CRM that runs your whole shop.
            </h1>
          </Reveal>

          <Reveal delay={140}>
            <p className="mx-auto mt-6 max-w-[46ch] text-[17px] leading-[1.65] text-ink-soft">
              Manage leads, customers, vehicles, quotes, jobs, invoices, payments and your entire
              workshop workflow from one simple platform.
            </p>
          </Reveal>

          <Reveal delay={210}>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/auth"
                className="inline-flex h-11 w-full items-center justify-center rounded-md bg-ink px-6 text-[15px] font-medium text-canvas shadow-soft transition-colors duration-200 hover:bg-deep-alt sm:w-auto"
              >
                Get Started
              </Link>
              <Link
                to="/auth"
                className="inline-flex h-11 w-full items-center justify-center rounded-md border border-hairline bg-surface px-6 text-[15px] font-medium text-ink transition-colors duration-200 hover:border-hairline-strong hover:bg-canvas sm:w-auto"
              >
                Sign In
              </Link>
            </div>
          </Reveal>
        </div>

        <Reveal delay={300} className="mt-16 sm:mt-20">
          <div className="mx-auto max-w-5xl">
            <div className="rounded-2xl border border-hairline bg-surface/70 p-1.5 shadow-frame sm:p-2">
              <BayBoardMock />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

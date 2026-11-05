import { Link } from "@tanstack/react-router";
import { Reveal } from "./reveal";

export function FinalCta() {
  return (
    <section className="border-y border-hairline bg-surface">
      <div className="container-page py-24 text-center sm:py-32">
        <Reveal>
          <h2 className="mx-auto max-w-[18ch] text-[2rem] font-semibold leading-[1.1] tracking-[-0.035em] text-ink sm:text-[3rem]">
            Stop running the studio from memory.
          </h2>
        </Reveal>

        <Reveal delay={90}>
          <p className="mx-auto mt-5 max-w-[44ch] text-[15px] leading-relaxed text-ink-soft">
            Set up takes minutes. Bring your service list and your first car.
          </p>
        </Reveal>

        <Reveal delay={160} className="mt-9">
          <Link
            to="/auth"
            className="inline-flex h-11 items-center justify-center rounded-md bg-ink px-7 text-[15px] font-medium text-canvas shadow-soft transition-colors duration-200 hover:bg-deep-alt"
          >
            Start free trial
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

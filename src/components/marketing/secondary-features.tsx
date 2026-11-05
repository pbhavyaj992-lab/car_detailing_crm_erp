import { Receipt, IndianRupee, Camera, ShieldCheck, Users, LayoutDashboard } from "lucide-react";
import { Reveal } from "./reveal";

const clusters = [
  {
    label: "Money",
    items: [
      {
        icon: Receipt,
        title: "Expenses, tracked per job",
        body: "Every cost logged against the vehicle it belongs to.",
      },
      {
        icon: IndianRupee,
        title: "Part-payments & outstanding",
        body: "Know exactly who owes what, without checking a ledger.",
      },
    ],
  },
  {
    label: "Trust with customers",
    items: [
      {
        icon: Camera,
        title: "Before/after on every vehicle",
        body: "Photo proof at intake and delivery, attached to the job.",
      },
      {
        icon: ShieldCheck,
        title: "Complete activity trail",
        body: "Every change recorded with who did it and when.",
      },
    ],
  },
  {
    label: "Team",
    items: [
      {
        icon: Users,
        title: "Role-based access",
        body: "Each staff member sees only what their role needs.",
      },
      {
        icon: LayoutDashboard,
        title: "One view across your team",
        body: "Owner-level oversight of every job, every bay, every day.",
      },
    ],
  },
];

export function SecondaryFeatures() {
  return (
    <section id="features" className="border-t border-hairline bg-surface">
      <div className="container-page py-24 sm:py-32">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,340px)_1fr] lg:gap-20">
          <Reveal>
            <div className="eyebrow text-ink-faint">Everything else</div>
            <h2 className="mt-5 max-w-[16ch] text-[1.85rem] font-semibold leading-[1.14] tracking-[-0.03em] text-ink sm:text-[2.5rem]">
              The rest of the studio, covered.
            </h2>
          </Reveal>

          <div className="grid gap-10 sm:grid-cols-3 sm:gap-8">
            {clusters.map((cluster, ci) => (
              <Reveal key={cluster.label} delay={ci * 80}>
                <div className="eyebrow text-copper">{cluster.label}</div>
                <div className="mt-6 space-y-7">
                  {cluster.items.map((item) => (
                    <div key={item.title}>
                      <item.icon
                        className="h-[17px] w-[17px] text-ink-faint"
                        strokeWidth={1.75}
                      />
                      <h3 className="mt-3 text-[14.5px] font-semibold tracking-[-0.01em] text-ink">
                        {item.title}
                      </h3>
                      <p className="mt-1.5 max-w-[34ch] text-[13.5px] leading-relaxed text-ink-soft">
                        {item.body}
                      </p>
                    </div>
                  ))}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

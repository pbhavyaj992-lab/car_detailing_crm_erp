import { Link } from "@tanstack/react-router";
import { IshanLogo } from "@/components/ishan-logo";

const productLinks = [
  { label: "How it works", href: "#workflow" },
  { label: "Features", href: "#capabilities" },
  { label: "Contact", href: "#contact" },
  { label: "Insights", href: "#insights" },
];

const linkClass = "text-[13.5px] text-ink-soft transition-colors duration-200 hover:text-ink";

export function MarketingFooter() {
  return (
    <footer className="border-t border-hairline bg-surface">
      <div className="container-page py-16">
        <div className="grid gap-12 sm:grid-cols-3">
          <div>
            <Link to="/" className="flex items-center gap-2.5">
              <IshanLogo className="h-[22px] w-[22px]" />
              <span className="text-[13px] font-semibold tracking-[0.26em] text-ink">ISHAN</span>
            </Link>
            <p className="mt-5 max-w-[28ch] text-[13.5px] leading-relaxed text-ink-soft">
              The operating system for professional detailing studios.
            </p>
          </div>

          <div>
            <div className="eyebrow text-ink-faint">Product</div>
            <ul className="mt-5 space-y-3">
              {productLinks.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className={linkClass}>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="eyebrow text-ink-faint">Contact</div>
            <ul className="mt-5 space-y-3">
              <li>
                <a href="tel:+919586461871" className={linkClass}>
                  +91 95864 61871
                </a>
              </li>
              <li>
                <a href="mailto:pbhavya0826@gmail.com" className={linkClass}>
                  pbhavya0826@gmail.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 border-t border-hairline pt-7 text-[13px] text-ink-faint">
          © {new Date().getFullYear()} Ishan. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { IshanLogo } from "@/components/ishan-logo";
import { cn } from "@/lib/utils";

const links = [
  { label: "How it works", href: "#workflow" },
  { label: "Features", href: "#capabilities" },
  { label: "Contact", href: "#contact" },
  { label: "Insights", href: "#insights" },
];

export function MarketingNav() {
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-300",
        solid
          ? "border-hairline bg-canvas/75 backdrop-blur-xl backdrop-saturate-150"
          : "border-transparent bg-transparent",
      )}
    >
      <nav className="container-page flex h-16 items-center justify-between gap-8">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <IshanLogo className="h-[22px] w-[22px] shrink-0" />
          <span className="text-[13px] font-semibold tracking-[0.26em] text-ink">ISHAN</span>
        </Link>

        <div className="hidden items-center gap-9 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[13.5px] text-ink-soft transition-colors duration-200 hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/auth"
            className="hidden rounded-md px-3 py-2 text-[13.5px] text-ink-soft transition-colors duration-200 hover:text-ink sm:inline-flex"
          >
            Log in
          </Link>
          <Link
            to="/auth"
            className="inline-flex h-9 items-center rounded-md bg-ink px-3.5 text-[13.5px] font-medium text-canvas shadow-soft transition-colors duration-200 hover:bg-deep-alt"
          >
            Get Started
          </Link>
        </div>
      </nav>
    </header>
  );
}

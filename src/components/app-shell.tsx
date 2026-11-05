import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Home, PlusCircle, Search, ClipboardList, LogOut, FileText, Receipt, Settings as SettingsIcon, Users, Activity, Images, UserCog, BarChart3, Wallet, Menu, Inbox, ShieldCheck } from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRoles, useProfile } from "@/hooks/use-session";
import { cn } from "@/lib/utils";
import { IshanLogo } from "@/components/ishan-logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useQueryClient } from "@tanstack/react-query";
import { LogoThumb } from "@/components/logo-upload";
import type { Company } from "@/lib/api/companies";

type NavItem = { to: string; label: string; icon: typeof Home; show: boolean };
type NavGroup = { label: string; items: NavItem[] };

export function AppShell({ children, company }: { children: ReactNode; company?: Company | null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isWorkerOnly, canFinance, isAdmin, isSuperAdmin } = useRoles();
  const { data: profile } = useProfile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const platformGroups: NavGroup[] = [
    {
      label: "Platform",
      items: [
        { to: "/admin", label: "Businesses", icon: ShieldCheck, show: true },
        { to: "/activity", label: "Activity", icon: Activity, show: true },
        { to: "/me", label: "My profile", icon: UserCog, show: true },
      ],
    },
  ];

  const tenantGroups: NavGroup[] = [
    {
      label: "Workspace",
      items: [
        { to: "/dashboard", label: "Dashboard", icon: Home, show: true },
        { to: "/new", label: "New Quote", icon: PlusCircle, show: true },
        { to: "/jobs", label: "Garage Board", icon: ClipboardList, show: true },
        { to: "/search", label: "Search", icon: Search, show: true },
      ],
    },
    {
      label: "Records",
      items: [
        { to: "/leads", label: "Leads", icon: Inbox, show: !isWorkerOnly },
        { to: "/quotes", label: "Quotes", icon: FileText, show: !isWorkerOnly },
        { to: "/customers", label: "Customers", icon: Users, show: !isWorkerOnly },
        { to: "/invoices", label: "Invoices", icon: Receipt, show: canFinance },
        { to: "/expenses", label: "Expenses", icon: Wallet, show: canFinance },
        { to: "/analytics", label: "Analytics", icon: BarChart3, show: canFinance },
        { to: "/gallery", label: "Gallery", icon: Images, show: true },
        
        
      ],
    },
    {
      label: "Admin",
      items: [
        { to: "/staff", label: "Staff", icon: UserCog, show: isAdmin },
        { to: "/duplicates", label: "Duplicates", icon: Users, show: isAdmin },
        { to: "/settings", label: "Settings", icon: SettingsIcon, show: isAdmin },
      ],
    },
  ];

  const groups: NavGroup[] = (isSuperAdmin ? platformGroups : tenantGroups)
    .map((g) => ({ ...g, items: g.items.filter((i) => i.show) }))
    .filter((g) => g.items.length > 0);


  const initials = (profile?.full_name ?? "")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "WS";

  const isActive = (to: string) =>
    location.pathname === to || location.pathname.startsWith(to + "/");

  const bottomNav = [
    { to: "/dashboard", label: "Home", icon: Home },
    { to: "/jobs", label: "Jobs", icon: ClipboardList },
    { to: "/new", label: "New", icon: PlusCircle, primary: true },
    { to: "/search", label: "Search", icon: Search },
  ] as const;

  function NavList({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <nav className="space-y-6">
        {groups.map((g) => (
          <div key={g.label}>
            <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
              {g.label}
            </div>
            <div className="space-y-0.5">
              {g.items.map((l) => {
                const active = isActive(l.to);
                return (
                  <Link
                    key={l.to}
                    to={l.to}
                    onClick={onNavigate}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <l.icon className={cn("h-4 w-4 shrink-0", active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                    {l.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-border md:bg-sidebar">
        <div className="flex h-16 items-center border-b border-border px-5">
          {isSuperAdmin ? (
            <div className="flex items-center gap-2">
              <IshanLogo className="h-8 w-8 object-contain" showText />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <LogoThumb value={company?.logo_url} name={company?.name} className="h-9 w-9" />
              <span className="truncate text-sm font-semibold tracking-tight">{company?.name || "Workspace"}</span>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <NavList />
        </div>
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-lg p-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-foreground text-[12px] font-semibold text-background">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground">{profile?.full_name ?? "Signed in"}</div>
              <div className="truncate text-xs text-muted-foreground">{isSuperAdmin ? "Platform Control" : (company?.name || "Workspace")}</div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={handleSignOut} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 pb-24 md:pb-0">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0">
                <SheetHeader className="border-b border-border px-5 py-4">
                  <SheetTitle className="flex items-center gap-2">
                    {isSuperAdmin ? (
                      <IshanLogo className="h-6 w-6 object-contain" showText />
                    ) : (
                      <>
                        <LogoThumb value={company?.logo_url} name={company?.name} className="h-6 w-6" />
                        <span className="truncate">{company?.name || "Workspace"}</span>
                      </>
                    )}
                  </SheetTitle>
                </SheetHeader>
                <div className="flex h-[calc(100vh-64px)] flex-col">
                  <div className="flex-1 overflow-y-auto px-3 py-5">
                    <NavList onNavigate={() => setMobileMenuOpen(false)} />
                  </div>
                  <div className="border-t border-border p-3">
                    <Link
                      to="/me"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 rounded-lg p-2 hover:bg-secondary/60"
                    >
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-foreground text-[12px] font-semibold text-background">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{profile?.full_name ?? "Signed in"}</div>
                        <div className="truncate text-xs text-muted-foreground">View profile</div>
                      </div>
                    </Link>
                    <Button variant="outline" className="mt-2 w-full" onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" /> Sign out
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            {isSuperAdmin ? (
              <IshanLogo className="h-6 w-6 object-contain" showText />
            ) : (
              <>
                <LogoThumb value={company?.logo_url} name={company?.name} className="h-6 w-6" />
                <span className="truncate text-sm font-semibold tracking-tight">{company?.name || "Workspace"}</span>
              </>
            )}
          </div>
          <Link to="/me" className="grid h-9 w-9 place-items-center rounded-full bg-foreground text-[11px] font-semibold text-background">
            {initials}
          </Link>
        </div>
        <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-8 md:py-8">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      {isSuperAdmin ? (
        <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur pb-safe md:hidden">
          <ul className="grid grid-cols-2">
            <li>
              <Link
                to="/admin"
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium text-muted-foreground transition-colors",
                  isActive("/admin") && "text-primary",
                )}
              >
                <ShieldCheck className={cn("h-5 w-5", isActive("/admin") && "text-primary")} />
                Businesses
              </Link>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="flex w-full flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium text-muted-foreground transition-colors"
              >
                <Menu className="h-5 w-5" />
                Menu
              </button>
            </li>
          </ul>
        </nav>
      ) : (
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur pb-safe md:hidden">
        <ul className="grid grid-cols-5">

          {bottomNav.slice(0, 2).map((n) => {
            const active = location.pathname === n.to || location.pathname.startsWith(n.to + "/");
            return (
              <li key={n.to}>
                <Link
                  to={n.to}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium text-muted-foreground transition-colors",
                    active && "text-primary",
                  )}
                >
                  <n.icon className={cn("h-5 w-5", active && "text-primary")} />
                  {n.label}
                </Link>
              </li>
            );
          })}
          <li className="flex items-center justify-center">
            <Link
              to="/new"
              className="mt-[-20px] grid h-14 w-14 place-items-center rounded-full bg-foreground text-background shadow-lg shadow-foreground/20 transition-transform active:scale-95"
            >
              <PlusCircle className="h-6 w-6" />
            </Link>
          </li>
          {bottomNav.slice(3).map((n) => {
            const active = location.pathname === n.to || location.pathname.startsWith(n.to + "/");
            return (
              <li key={n.to}>
                <Link
                  to={n.to}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium text-muted-foreground transition-colors",
                    active && "text-primary",
                  )}
                >
                  <n.icon className={cn("h-5 w-5", active && "text-primary")} />
                  {n.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex w-full flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium text-muted-foreground transition-colors"
            >
              <Menu className="h-5 w-5" />
              Menu
            </button>
          </li>
        </ul>
      </nav>
      )}

    </div>
  );
}

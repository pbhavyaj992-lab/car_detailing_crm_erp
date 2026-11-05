import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, Phone, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { recordLoginEvent } from "@/lib/api/login-events";
import { IshanLogo } from "@/components/ishan-logo";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in | Ishan Car Detailing CRM" },
      { name: "description", content: "Sign in to your Ishan workspace to manage leads, jobs, invoices and payments for your detailing business." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Sign in | Ishan Car Detailing CRM" },
      { property: "og:description", content: "Sign in to your Ishan workspace to manage leads, jobs, invoices and payments for your detailing business." },
      { property: "og:url", content: "https://getishan.in/auth" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://getishan.in/auth" }],
  }),
  component: AuthPage,
});

const CAPABILITIES = [
  "Leads & customer management",
  "Quotes, jobs & invoices",
  "Payments & business analytics",
  "Staff, activity & vehicle history",
];

const PHONE_DISPLAY = "+91 95864 61871";
const PHONE_TEL = "tel:+919586461871";
const EMAIL = "pbhavya0826@gmail.com";

function AuthPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Never let a hanging/failed session lookup blank the page.
    const fallback = setTimeout(() => !cancelled && setChecked(true), 1500);
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        if (data.session) navigate({ to: "/dashboard", replace: true });
        else setChecked(true);
      })
      .catch(() => !cancelled && setChecked(true));
    return () => {
      cancelled = true;
      clearTimeout(fallback);
    };
  }, [navigate]);

  function validate() {
    const value = identifier.trim();
    let idErr: string | null = null;
    let pwErr: string | null = null;

    if (!value) {
      idErr = "Enter your email address or phone number.";
    } else {
      const looksLikeEmail = value.includes("@");
      const digits = value.replace(/[^0-9]/g, "");
      if (looksLikeEmail) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value))
          idErr = "That email address doesn't look valid.";
      } else if (digits.length < 10) {
        idErr = "Enter a valid 10-digit phone number or an email address.";
      }
    }

    if (!password) pwErr = "Enter your password.";
    else if (password.length < 8) pwErr = "Your password must be at least 8 characters.";

    setIdentifierError(idErr);
    setPasswordError(pwErr);
    return !idErr && !pwErr;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      const { signInWithIdentifier } = await import("@/lib/auth.functions");
      const tokens = await signInWithIdentifier({ data: { identifier, password } });

      const { error } = await supabase.auth.setSession({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      });
      if (error) throw error;

      void recordLoginEvent("sign_in");
      navigate({ to: "/dashboard", replace: true });
    } catch (err: any) {
      const message = err?.message?.toLowerCase?.().includes("invalid")
        ? "That email/phone and password combination doesn't match an account."
        : err?.message || "Authentication failed. Please try again.";
      setFormError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  if (!checked)
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand / product panel */}
      <div className="relative hidden flex-col justify-between bg-slate-950 p-12 text-white lg:flex">
        <div>
          <Link to="/" className="inline-flex items-center gap-3">
            <IshanLogo className="h-9 w-9 object-contain" />
            <span className="text-sm font-semibold tracking-[0.3em]">ISHAN</span>
          </Link>
        </div>

        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Everything you need to run your automotive service business.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/60">
            The operating system for detailing, PPF, ceramic coating and car-care businesses.
          </p>
          <ul className="mt-8 space-y-3">
            {CAPABILITIES.map((c) => (
              <li key={c} className="flex items-start gap-3 text-sm text-white/75">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
                {c}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap gap-5 text-xs text-white/50">
          <a href={PHONE_TEL} className="inline-flex items-center gap-2 hover:text-white">
            <Phone className="h-3.5 w-3.5" /> {PHONE_DISPLAY}
          </a>
          <a href={`mailto:${EMAIL}`} className="inline-flex items-center gap-2 hover:text-white">
            <Mail className="h-3.5 w-3.5" /> {EMAIL}
          </a>
        </div>
      </div>

      {/* Sign-in panel */}
      <div className="flex items-center justify-center bg-muted/30 p-4 sm:p-8">
        <div className="w-full max-w-[420px]">
          <div className="mb-6 flex flex-col items-center gap-4 lg:hidden">
            <IshanLogo className="h-12 w-12 object-contain" showText />
            <div className="grid w-full grid-cols-2 gap-2">
              <a
                href={PHONE_TEL}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background"
              >
                <Phone className="h-4 w-4" /> Call us
              </a>
              <a
                href={`mailto:${EMAIL}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm font-medium text-foreground"
              >
                <Mail className="h-4 w-4" /> Email us
              </a>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-md sm:p-10">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h1>
            <p className="mt-2 text-sm text-muted-foreground">Sign in to your Ishan workspace.</p>
            <p className="mt-1 text-xs text-muted-foreground/80">
              Precision in every detail. Simplicity in every workflow.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-[11px] font-medium text-muted-foreground">
              <Lock className="h-3 w-3" /> Secure sign-in
            </div>



            <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="identifier">Email or phone number</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="identifier"
                    placeholder="name@example.com"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      if (identifierError) setIdentifierError(null);
                    }}
                    aria-invalid={!!identifierError}
                    aria-describedby={identifierError ? "identifier-error" : undefined}
                    className="pl-9"
                  />
                </div>
                {identifierError && (
                  <p id="identifier-error" className="text-xs text-destructive">
                    {identifierError}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (passwordError) setPasswordError(null);
                    }}
                    aria-invalid={!!passwordError}
                    aria-describedby={passwordError ? "password-error" : undefined}
                    className="pl-9"
                  />
                </div>
                {passwordError && (
                  <p id="password-error" className="text-xs text-destructive">
                    {passwordError}
                  </p>
                )}
              </div>

              {formError && (
                <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {formError}
                </p>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Please wait…
                  </span>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Trouble signing in? Call{" "}
              <a href={PHONE_TEL} className="font-medium text-foreground hover:underline">
                {PHONE_DISPLAY}
              </a>{" "}
              or email{" "}
              <a href={`mailto:${EMAIL}`} className="font-medium text-foreground hover:underline">
                {EMAIL}
              </a>
              .
            </p>
          </div>

          <div className="mt-6 text-center">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

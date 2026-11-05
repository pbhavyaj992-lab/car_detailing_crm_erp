import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizePhone } from "./format";

const GENERIC_ERROR = "That email/phone and password combination doesn't match an account.";

/**
 * Resolves an email-or-phone identifier and signs in — entirely server side.
 * The resolved email address is never returned to the browser, and every
 * failure path returns the same generic message so the endpoint cannot be
 * used to enumerate accounts or map phone numbers to login emails.
 */
export const signInWithIdentifier = createServerFn({ method: "POST" })
  .inputValidator((d: { identifier: string; password: string }) =>
    z
      .object({
        identifier: z.string().trim().min(1).max(255),
        password: z.string().min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { identifier, password } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: isAllowed } = await supabaseAdmin.rpc("check_auth_rate_limit" as never, {
      _identifier: identifier,
    } as never);
    if (isAllowed === false) {
      throw new Error("Too many attempts. Please try again later.");
    }

    let email: string | null = null;

    if (identifier.includes("@")) {
      email = identifier.toLowerCase();
    } else {
      const phone = normalizePhone(identifier);
      if (phone) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("phone", phone)
          .maybeSingle();
        if (profile?.id) {
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(profile.id);
          email = authUser?.user?.email ?? null;
        }
      }
    }

    if (!email) throw new Error(GENERIC_ERROR);

    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env["SUPABASE_URL"]!;
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"]!;
    const anon = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
            h.delete("Authorization");
          }
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const { data: signIn, error } = await anon.auth.signInWithPassword({ email, password });
    if (error || !signIn.session) throw new Error(GENERIC_ERROR);

    return {
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
    };
  });

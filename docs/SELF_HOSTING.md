# Self-Hosting Guide

This CRM is a plain **TanStack Start + Vite + React** app backed by **Supabase**. Nothing depends on Lovable at runtime — moving to your own Supabase project + your own host is an env-var change plus running the SQL migrations.

## 1. Create your Supabase project

1. Sign up at [supabase.com](https://supabase.com) and create a new project.
2. From **Project Settings → API**, copy:
   - `Project URL` → `SUPABASE_URL` / `VITE_SUPABASE_URL`
   - `Publishable / anon key` → `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `Service role key` → `MY_SUPABASE_SERVICE_ROLE_KEY` (**server only, never expose**)

## 2. Apply the schema

Two options:

**Option A — Supabase CLI (recommended):**

```bash
supabase link --project-ref YOUR-PROJECT-REF
supabase db push          # applies every file under supabase/migrations/
psql "$SUPABASE_DB_URL" -f supabase/seed.sql   # optional: default company + services
```

**Option B — SQL editor:**

Open **SQL Editor** in the Supabase dashboard, paste each file in `supabase/migrations/` in filename order, then paste `supabase/seed.sql`.

## 3. Storage buckets

Create these private buckets under **Storage**:
- `vehicle-media`
- `expense-bills`

## 4. Auth providers

Under **Authentication → Providers**, enable **Email** and optionally **Google**. Disable anonymous sign-ups if you don't want them.

## 5. Configure env vars locally

```bash
cp .env.example .env
# fill in the values from step 1
bun install
bun run dev
```

## 6. First super-admin

Sign up your first account through the app's `/auth` page. `handle_new_user()` automatically promotes the first user to `super_admin` in the default company.

## 7. Deploy the frontend

Any host that runs Node/edge works — Vercel, Netlify, Cloudflare Pages, Railway, Render, or your own VPS. Set the same env vars on the host and deploy.

### Vercel env vars — set exactly these

| Name | Scope | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | browser | Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | browser | Publishable / anon key |
| `SUPABASE_URL` | server | same value as above |
| `SUPABASE_PUBLISHABLE_KEY` | server | same value as above |
| `MY_SUPABASE_SERVICE_ROLE_KEY` | server | privileged platform-admin functions only |
| `LOVABLE_API_KEY` | server | only if AI features are used |

Do **not** set `SUPABASE_PROJECT_ID` or `VITE_SUPABASE_PROJECT_ID` — nothing reads them.

Keep the `MY_` prefix on the service role key. Vercel's built-in Supabase
integration owns the unprefixed `SUPABASE_SERVICE_ROLE_KEY` name and will
overwrite it.

Without `MY_SUPABASE_SERVICE_ROLE_KEY` the app still runs: everything that acts
as the signed-in user works normally, and only the privileged platform-admin
server functions (create/delete company, platform user management) fail.

### Auth redirect URLs

In the Supabase project, **Authentication → URL Configuration**, add the Vercel
production domain (and any preview domains) to *Site URL* / *Redirect URLs*.
Sign-in redirects fail on the deployed site otherwise.

```bash
vercel link
vercel env add SUPABASE_URL production
# ...repeat for the rest
vercel --prod
```


## What lives where

| Concern | Location |
| --- | --- |
| SQL schema, RLS, functions, triggers | `supabase/migrations/*.sql` |
| Default seed data | `supabase/seed.sql` |
| Supabase clients | `src/integrations/supabase/*` (auto-generated — do not edit) |
| App-internal server logic | `src/lib/*.functions.ts` (TanStack `createServerFn`) |
| Webhooks / public APIs | `src/routes/api/public/*` |

## Multi-tenant readiness

Every business table has a `company_id` column and a default company seeded as "Default Company". The `current_company_id()` SQL helper resolves the caller's company via `user_roles`. To enable multi-tenant sign-up later, you only need to:

1. Update the sign-up flow to create/select a company.
2. Add `company_id = public.current_company_id()` predicates to the RLS policies on the business tables (the columns and helper are already in place).

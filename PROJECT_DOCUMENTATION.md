# Project Documentation: Ishan — Car Detailing OS

## 1. Project Overview
Ishan is a comprehensive, multi-tenant Business Operations Platform (BOP) specifically engineered for the professional car detailing industry. It serves as a centralized "Studio OS" to manage the end-to-end vehicle lifecycle.

*   **Users**:
    *   **Platform Super Admin**: Manages the SaaS platform, creates/deletes companies (tenants), and monitors global stats.
    *   **Studio Owner**: Full access to studio-specific data, staff management, and financial analytics.
    *   **Manager**: Operations oversight, job assignment, and customer management.
    *   **Reception/Supervisor**: Customer intake, enquiry handling, and billing.
    *   **Worker/Detailer**: Task-focused access to job cards and checklists.
*   **Business Model**: A multi-tenant SaaS platform where detailing studios subscribe to a dedicated instance (tenant) of the software.
*   **Core Workflow**:
    1.  **Enquiry**: Capture lead details and vehicle requirements.
    2.  **Quote**: Generate professional estimates with service line items.
    3.  **Booking**: Convert approved quotes into scheduled jobs.
    4.  **Job (Bay Board)**: Track the vehicle through workshop stages (Received → Inspection → Work Started → Quality Check → Ready).
    5.  **Delivery**: Final inspection, invoicing, payment collection, and vehicle release.

---

## 2. Tech Stack

### Framework & Routing
*   **React 19**: Frontend UI library.
*   **TanStack Start v1**: Full-stack framework providing SSR, server functions, and API routing.
*   **TanStack Router**: Type-safe routing system (`src/routes`).

### Styling & UI
*   **Tailwind CSS v4**: Utility-first CSS framework with native CSS variables.
*   **Design Tokens**: Managed in `src/styles.css` using OKLCH color values for a modern, high-contrast "Enterprise" aesthetic.
*   **Radix UI**: Accessible headless primitives. Primitives used:
    *   `Accordion`, `Alert Dialog`, `Avatar`, `Checkbox`, `Dialog`, `Dropdown Menu`, `Label`, `Navigation Menu`, `Popover`, `Progress`, `Scroll Area`, `Select`, `Separator`, `Slider`, `Switch`, `Tabs`, `Tooltip`.
*   **Lucide React**: Icon library.
*   **Sonner**: Toast notifications.

### Backend & Database
*   **Supabase**: Backend-as-a-Service (BaaS).
    *   **Database**: PostgreSQL with Row Level Security (RLS).
    *   **Auth**: Supabase Auth (Email & Phone-based).
    *   **Storage**: Supabase Storage for company logos and vehicle media.
    *   **Client**: `@supabase/supabase-js` v2.110.7, initialized in `src/integrations/supabase/client.ts`.

### State Management & Logic
*   **TanStack Query (v5)**: Server state management (fetching, caching, synchronization).
*   **React Hook Form**: Form state and validation.
*   **Zod**: Schema validation for forms and server functions.
*   **Server Functions**: `createServerFn` from `@tanstack/react-start` used for privileged operations (e.g., admin tasks).

### Other Notable Packages
*   **Recharts**: Data visualization for studio analytics.
*   **jspdf & html2canvas-pro**: PDF generation for quotes and invoices.
*   **date-fns**: Date manipulation.

---

## 3. Architecture

### Folder Structure
*   `src/routes/`: Route definitions and page components.
    *   `_authenticated/`: Protected routes requiring login.
    *   `admin/`: Platform-level Super Admin management.
*   `src/components/`: Reusable UI components.
    *   `ui/`: Base Shadcn-like primitives.
*   `src/lib/`: Business logic, utilities, and API wrappers.
    *   `api/`: Supabase query wrappers.
*   `src/hooks/`: Custom React hooks (e.g., `use-session.ts`).
*   `src/integrations/supabase/`: Generated Supabase client and types.
*   `supabase/migrations/`: SQL migration files defining the schema and RLS.

### Routing & Access Control
*   **Public**: `/`, `/auth`.
*   **Super Admin**: `/admin`, `/admin/companies`, `/admin/users`. Protected via `user_roles` check.
*   **Tenant Authenticated**: `/dashboard`, `/leads`, `/quotes`, `/jobs`, `/customers`, `/staff`. Protected via `_authenticated` layout gate.

### Data Flow
1.  **UI Action**: User submits a form or clicks a button.
2.  **API Wrapper**: Calls a function in `src/lib/api/` using the Supabase client.
3.  **Supabase**: Executes query against PostgreSQL. RLS policies intercept the request to ensure tenant isolation.
4.  **TanStack Query**: Updates the client-side cache and triggers re-renders.

---

## 4. Authentication & Authorization

### Auth Flow
*   **Dual Login**: Supports both Email/Password and Phone Number login.
*   **Phone Login Implementation**: 
    1.  User enters phone number.
    2.  `resolveLoginIdentifier` server function (`src/lib/auth.functions.ts`) looks up the profile by phone.
    3.  Retrieves the associated email and proceeds with standard Supabase password auth.
*   **Self-Signup**: Public self-signup is disabled to maintain a controlled SaaS environment. Users are created by Super Admins or Studio Admins.

### Role Model
*   **super_admin**: Platform-wide access. Can manage all companies and users.
*   **owner**: Full access to their own company's data, including billing and staff management.
*   **manager**: Full operational access; cannot manage company-level settings or delete owners.
*   **reception**: Can manage leads, quotes, and customers; limited financial deletion rights.
*   **worker**: Read-only access to assigned job cards and status updates.

### Session Handling
*   **Storage**: JWTs stored in browser `localStorage`.
*   **Auth Attacher**: `src/integrations/supabase/auth-attacher.ts` ensures the bearer token is sent with every server function call.

---

## 5. Database Schema

### Primary Tables
*   **companies**: Tenants (studios). Columns: `id`, `name`, `logo_url`, `slug`.
*   **profiles**: User profiles linked to `auth.users`.
*   **user_roles**: Maps users to `app_role` and `company_id`.
*   **customers**: Studio clients. Columns: `id`, `company_id`, `name`, `phone`, `normalized_phone`.
*   **vehicles**: Customer cars. Columns: `id`, `company_id`, `customer_id`, `number`, `brand`, `model`.
*   **quotes**: Estimates. Columns: `id`, `company_id`, `total`, `status` (draft/approved/converted).
*   **jobs**: Active workshop orders. Columns: `id`, `company_id`, `status`, `assigned_to` (uuid array).
*   **invoices**: Billing records. Columns: `id`, `company_id`, `total`, `paid_amount`, `status`.
*   **inquiries**: Leads/Follow-ups.
*   **activity_log**: Global audit trail of actions.

### Security & RLS
*   **Isolation Logic**: Every tenant-specific table has a `company_id` column.
*   **Helper Function**: `public.in_my_company(company_id)` checks if the `auth.uid()` has a record in `user_roles` for that `company_id`.
*   **Enforcement**: 
    *   `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` is applied to all public tables.
    *   Policies: `USING (public.in_my_company(company_id))` ensures no cross-tenant data leakage.
*   **Super Admin Bypass**: Policies typically include `OR public.current_user_is_super_admin()` to allow platform management.

---

## 6. Core Features — Implementation Detail

### Customers & Vehicles
*   **Logic**: `src/lib/api/customers.ts` handles lookup and creation.
*   **Unique Constraint**: Customers are unique per tenant based on `normalized_phone`.

### Quote Builder
*   **Implementation**: `src/routes/_authenticated/new.tsx` uses a multi-step form.
*   **Conversion**: `convertQuoteToJob` RPC moves data from `quotes` to `jobs`.

### Live Bay Board
*   **UI**: `src/routes/_authenticated/dashboard.tsx`.
*   **Mechanism**: Powered by TanStack Query polling/refetching. Displays vehicles in `received` through `ready` statuses.

### Gallery (Before/After)
*   **Storage**: `job-media` bucket.
*   **Logic**: `src/lib/api/media.ts` manages uploads. Photos are tagged by `media_stage` (pre_work/post_work).

### Invoicing & Payments
*   **Tracking**: `paid_amount` vs `total` on the `invoices` table.
*   **Adjustment**: Support for "rounding off" differences, recorded as an expense if partially paid but marked as full.

---

## 7. Multi-tenancy
*   **Hard Isolation**: Enforced at the database level via PostgreSQL RLS.
*   **Verification**: A Manager from Studio A cannot query Studio B's data because the `in_my_company` function returns false for any `company_id` not linked to their `user_id` in `user_roles`.

---

## 8. Environment & Configuration
*   **Required Env Vars**:
    *   `VITE_SUPABASE_URL`: Supabase project URL.
    *   `VITE_SUPABASE_ANON_KEY`: Public API key.
    *   `SUPABASE_SERVICE_ROLE_KEY`: Used in server functions for admin tasks.
*   **Manual Config**:
    *   **Storage Buckets**: `company-logos`, `job-media`.
    *   **Database Functions**: `delete_company_completely` must be present for clean tenant removal.

---

## 9. Production Readiness Checklist

| Item | Status | Notes |
| :--- | :--- | :--- |
| Error Boundaries | **Yes** | Implemented in `__root.tsx` and major routes. |
| Loading/Empty States | **Yes** | Skeleton screens and `EmptyState` components used throughout. |
| Input Validation | **Yes** | Zod schemas on both frontend (forms) and backend (server functions). |
| Rate Limiting | **Partial** | Managed by Supabase Auth for OTP/Login. |
| Automated Tests | **None** | No e2e or unit tests found in `/tests`. |
| Hardcoded Secrets | **No** | Verified use of environment variables. |
| Upload Limits | **Yes** | Enforced by Supabase Storage configuration. |
| Mobile Responsiveness | **Yes** | Fully responsive dashboards using Tailwind. |
| Accessibility | **Yes** | Uses Radix UI primitives for keyboard/aria support. |
| Monitoring | **No** | No external logging (Sentry/LogRocket) configured. |
| DB Backups | **Yes** | Managed by Lovable Cloud/Supabase infrastructure. |

---

## 10. Deployment
*   **Hosting**: Lovable Cloud (Edge Runtime).
*   **Build Command**: `vite build`.
*   **Environment Requirements**: TanStack Start SSR requires a Node.js compatible environment with `nodejs_compat` enabled.

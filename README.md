# Reservo

A responsive booking platform concept for local service businesses and their customers.

## What's included

- Premium, responsive landing page and service discovery.
- Albanian and English interface, with Albanian as the default and language choice saved in the browser.
- Business directory with category and keyword search, featured and recent listings, business profiles, services, prices, and working hours.
- Guest booking flow with required name and phone, optional email, date and availability selection, and a booking confirmation. Customers do not need an account.
- Four-step business setup, service and schedule management, appointment lists, business profile editing, and publish controls.
- Supabase/PostgreSQL schema foundation for business categories, owner membership, locations, hours, closures, services, and bookings.
- Centralized brand tokens in `src/lib/branding.ts`.

## Run locally

Requirements: Node.js 20.9+ (Node 24 recommended).

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Use the **AL / EN** switcher in the navigation to change languages. The selection applies immediately across discovery, booking, confirmation, and the business dashboard, and is remembered when you return or reload the page.

## Supabase setup

The app uses Supabase Auth and the configured PostgreSQL API. Configure `.env.local` with the project URL and publishable/anon key from `.env.example`.

In Supabase Auth settings, enable email confirmations and add the app origin (for example `http://localhost:3000`) to the allowed redirect URLs. Registration returns users to the app after email confirmation; they can then sign in and continue onboarding or open their existing business dashboard. Supabase client sessions persist across refreshes.

The connected project uses `businesses.created_by` as the owner relationship, with related `locations` and `services` and guest appointments in `appointments`. The `supabase/schema.sql` file is a separate normalized schema draft; do not apply it over the connected project without first reconciling its table and column differences.

Guest bookings are inserted with `pending` status and do not require customer accounts. A business owner confirms or cancels pending requests from the dashboard. The customer flow uses `get_public_appointment_availability` to read only occupied times and durations; customers do not receive appointment contact details. Business and appointment changes are persisted through Supabase.

Review `supabase/guest_appointment_security.sql` against the connected project before running it. It expects `appointments` with nullable `service_id`, `location_id`, and `staff_id`, and validates staff against `public.staff`. Its initial schema check aborts if required tables or columns are missing. It replaces the pending-insert policy, exposes only non-identifying availability through an RPC, and limits appointment reads to business creators and owner/admin members through `public.is_business_admin(uuid)`. It leaves existing UPDATE and DELETE policies untouched and aborts when unreviewed restrictive SELECT/INSERT policies exist. Do not apply it to the separate normalized schema in `supabase/schema.sql` without reconciling the structures. Confirm that existing owner update policies permit owners to change their own appointments from pending to confirmed/cancelled.

Before applying the migration, inspect the live policies and table grants in the Supabase SQL Editor:

```sql
select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'appointments'
order by cmd, policyname;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'appointments'
  and grantee in ('anon', 'authenticated', 'PUBLIC')
order by grantee, privilege_type;
```

Verify that all existing restrictive SELECT/INSERT policies are understood and do not conflict with guest inserts or `is_business_admin` membership access. The migration stops if unreviewed restrictive policies remain.

Row-level security must restrict every owner write by `businesses.created_by`; direct client-side filters are not a security boundary. The insert policy checks business, service, location, and optional staff ownership/active state. For production-grade concurrent booking protection, add a server-side transactional booking operation or database exclusion constraint for overlapping appointment times.

Business images currently use public image URLs; uploads need a configured Supabase Storage bucket and policies.

To create a production build:

```bash
npm run build
npm start
```

## Next development milestones

1. Verify owner-scoped RLS policies and transactional booking conflict protection in the connected project.
2. Configure Storage for business image uploads.
3. Add notifications, account recovery, and plan limits.

## Tech

- Next.js App Router
- React
- TypeScript
- Plain CSS (no UI component dependency)
- Supabase Auth and PostgreSQL

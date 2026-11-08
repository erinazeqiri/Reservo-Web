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

## Prototype and backend status

The customer and business flows currently run in **prototype mode**. Example directory entries are sample data; businesses created in onboarding and their bookings exist only in the current page session. They are not written to the database, shared with another browser, or restored after refresh. The prototype banner indicates this throughout the app.

The registration form does not create an authenticated account and never stores the entered password. The dashboard is a same-session UI demonstration, not an access-controlled owner portal. Do not use it for real accounts or customer information.

`supabase/schema.sql` is a database foundation only. No Supabase client, URL, keys, authentication flow, database connection, publication query, or booking API is configured. Row-level security is enabled without permissive policies. Before production, configure Supabase Auth and storage, apply reviewed owner-scoped RLS policies, expose a safe public directory, and create a server-side/transactional guest-booking operation that validates working hours, closures, service activity, and overlapping reservations. Do not implement these operations using client-side storage or the public anon key alone.

The business profile image field accepts a public image URL in this prototype; file uploads require a configured storage service.

To create a production build:

```bash
npm run build
npm start
```

## Next development milestones

1. Configure Supabase Auth and complete the owner sign-up/session flow.
2. Apply and test owner-scoped RLS policies and the public business directory.
3. Persist onboarding, business hours, closures, services, and profile images.
4. Add a transactional guest-booking API with server-validated availability and conflict protection.
5. Add notifications, account recovery, and plan limits.

## Tech

- Next.js App Router
- React
- TypeScript
- Plain CSS (no UI component dependency)
- Supabase/PostgreSQL schema draft

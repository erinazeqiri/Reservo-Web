# Reservo

A responsive booking platform concept for local service businesses and their customers.

## What's included

- Premium, responsive landing page and service discovery.
- Category filters and service search.
- Customer booking flow with date/time selection and confirmation.
- Business dashboard with sample appointments and overview metrics.
- Supabase/PostgreSQL multi-tenant schema foundation in `supabase/schema.sql`.
- Centralized brand tokens in `src/lib/branding.ts`.

## Run locally

Requirements: Node.js 20.9+ (Node 24 recommended).

```bash
npm install
npm run dev
```

Open http://localhost:3000.

To create a production build:

```bash
npm run build
npm start
```

## Demo limitations

This first build is a **front-end demo**. Bookings are stored only in React state and reset when you refresh. The dashboard uses sample data. There is no live authentication, database, email delivery, payment processing, or real availability checking yet.

The SQL file is the proposed Supabase database foundation, not a production-ready deployment. It enables RLS but intentionally does not add permissive policies. Before connecting real customers, implement and test membership-scoped policies and a secure guest-booking RPC.

## Next development milestones

1. Connect Supabase Auth and apply reviewed RLS policies.
2. Implement business onboarding, locations, services, staff, and schedules.
3. Add real availability calculation and conflict-safe booking creation.
4. Add customer and business account flows, notifications, and plan limits.
5. Package the responsive web app for Android with Capacitor.

## Tech

- Next.js App Router
- React
- TypeScript
- Plain CSS (no UI component dependency)
- Supabase/PostgreSQL schema draft

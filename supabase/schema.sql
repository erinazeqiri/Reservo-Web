-- Reservo multi-tenant foundation (Supabase / PostgreSQL)
-- Apply in a fresh Supabase project after reviewing the schema.
create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create type public.member_role as enum ('owner', 'admin', 'manager', 'staff');
create type public.booking_status as enum ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');

-- Add business types by inserting rows instead of changing an enum.
create table public.business_categories (
  category_key text primary key,
  name_sq text not null,
  name_en text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0
);

insert into public.business_categories (category_key, name_sq, name_en, sort_order) values
  ('hair_salon', 'Sallon flokësh', 'Hair salon', 1),
  ('barbershop', 'Berberhane', 'Barbershop', 2),
  ('beauty_salon', 'Sallon bukurie', 'Beauty salon', 3),
  ('nail_studio', 'Studio thonjsh', 'Nail studio', 4),
  ('spa_wellness', 'Spa dhe mirëqenie', 'Spa & wellness', 5),
  ('dental_clinic', 'Klinikë dentare', 'Dental clinic', 6),
  ('medical_clinic', 'Klinikë mjekësore', 'Medical clinic', 7),
  ('fitness', 'Fitnes dhe stërvitje personale', 'Fitness & personal training', 8),
  ('photography', 'Fotografi', 'Photography', 9),
  ('automotive', 'Shërbime për automjete', 'Automotive services', 10),
  ('other', 'Shërbime të tjera', 'Other services', 11)
on conflict (category_key) do nothing;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category_key text not null references public.business_categories(category_key),
  phone text not null,
  email text,
  description text,
  profile_image_url text,
  country_code char(2) not null,
  currency char(3) not null default 'EUR',
  default_locale text not null default 'sq',
  timezone text not null default 'Europe/Pristina',
  is_published boolean not null default false,
  is_active boolean not null default true,
  published_at timestamptz,
  created_at timestamptz not null default now()
);
create index published_business_directory
  on public.businesses(category_key, created_at desc)
  where is_published and is_active;

create table public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  address text,
  timezone text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, id)
);

create table public.business_working_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  location_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  is_closed boolean not null default false,
  opens_at time,
  closes_at time,
  created_at timestamptz not null default now(),
  unique (location_id, weekday),
  foreign key (business_id, location_id) references public.locations(business_id, id) on delete cascade,
  check (is_closed or (opens_at is not null and closes_at is not null and closes_at > opens_at))
);

create table public.business_closures (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  location_id uuid,
  starts_on date not null,
  ends_on date not null,
  reason text,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  foreign key (business_id, location_id) references public.locations(business_id, id) on delete cascade
);
create index business_closure_dates on public.business_closures(business_id, starts_on, ends_on);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes integer not null check (duration_minutes > 0),
  price_minor bigint not null check (price_minor >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, id)
);

create table public.location_services (
  business_id uuid not null,
  location_id uuid not null,
  service_id uuid not null,
  price_minor bigint check (price_minor >= 0),
  duration_minutes integer check (duration_minutes > 0),
  is_active boolean not null default true,
  primary key (location_id, service_id),
  foreign key (business_id, location_id) references public.locations(business_id, id) on delete cascade,
  foreign key (business_id, service_id) references public.services(business_id, id) on delete cascade
);

create table public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  display_name text not null,
  is_active boolean not null default true,
  unique (business_id, id)
);

create table public.staff_locations (
  business_id uuid not null,
  staff_id uuid not null,
  location_id uuid not null,
  primary key (staff_id, location_id),
  foreign key (business_id, staff_id) references public.staff_profiles(business_id, id) on delete cascade,
  foreign key (business_id, location_id) references public.locations(business_id, id) on delete cascade
);

create table public.staff_services (
  business_id uuid not null,
  staff_id uuid not null,
  service_id uuid not null,
  primary key (staff_id, service_id),
  foreign key (business_id, staff_id) references public.staff_profiles(business_id, id) on delete cascade,
  foreign key (business_id, service_id) references public.services(business_id, id) on delete cascade
);

create table public.staff_schedules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  location_id uuid not null,
  staff_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  starts_local time not null,
  ends_local time not null,
  effective_from date,
  effective_until date,
  foreign key (business_id, location_id) references public.locations(business_id, id) on delete cascade,
  foreign key (business_id, staff_id) references public.staff_profiles(business_id, id) on delete cascade,
  check (ends_local > starts_local)
);

create table public.business_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  plan text not null check (plan in ('free', 'pro', 'business')),
  status text not null default 'active',
  is_current boolean not null default true,
  started_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index one_current_subscription_per_business
  on public.business_subscriptions(business_id) where is_current;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  location_id uuid not null,
  service_id uuid,
  staff_id uuid,
  customer_user_id uuid references public.profiles(id) on delete set null,
  customer_name text not null,
  customer_email text,
  customer_phone text not null,
  service_name_snapshot text not null,
  duration_minutes_snapshot integer not null check (duration_minutes_snapshot > 0),
  price_minor_snapshot bigint not null check (price_minor_snapshot >= 0),
  currency char(3) not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.booking_status not null default 'pending',
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (business_id, location_id) references public.locations(business_id, id),
  foreign key (business_id, service_id) references public.services(business_id, id),
  foreign key (business_id, staff_id) references public.staff_profiles(business_id, id)
);

-- Prevent overlapping active bookings for the same staff member.
alter table public.bookings add constraint no_overlapping_staff_bookings
  exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (staff_id is not null and status in ('pending', 'confirmed'));

-- Guest bookings without an assigned staff member still cannot overlap.
alter table public.bookings add constraint no_overlapping_unassigned_business_bookings
  exclude using gist (
    business_id with =,
    location_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (staff_id is null and status in ('pending', 'confirmed'));

create table public.appointment_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  booking_id uuid not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (business_id, booking_id) references public.bookings(business_id, id) on delete cascade
);

-- RLS: enable on every tenant-owned table. Production policies should be
-- added only after helper functions and guest-booking RPCs are reviewed.
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_categories enable row level security;
alter table public.business_members enable row level security;
alter table public.locations enable row level security;
alter table public.business_working_hours enable row level security;
alter table public.business_closures enable row level security;
alter table public.services enable row level security;
alter table public.location_services enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.staff_locations enable row level security;
alter table public.staff_services enable row level security;
alter table public.staff_schedules enable row level security;
alter table public.business_subscriptions enable row level security;
alter table public.bookings enable row level security;
alter table public.appointment_events enable row level security;

-- Intentionally no permissive policies are added here. The app must not
-- expose tenant data until membership-scoped RLS policies are configured.

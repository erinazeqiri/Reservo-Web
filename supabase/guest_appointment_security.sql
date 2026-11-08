-- Guest appointment security for the verified Reservo API schema.
-- Review existing appointment policies and grants before applying.
-- This migration does not change UPDATE or DELETE policies.

do $$
declare
  missing_columns text[];
begin
  if to_regclass('public.appointments') is null
    or to_regclass('public.businesses') is null
    or to_regclass('public.services') is null
    or to_regclass('public.locations') is null
    or to_regclass('public.staff') is null then
    raise exception 'Expected appointments, businesses, services, locations, and staff tables in public schema.';
  end if;

  if to_regprocedure('public.is_business_admin(uuid)') is null then
    raise exception 'Expected public.is_business_admin(uuid). Preserve and verify this owner/admin helper before applying this migration.';
  end if;

  select array_agg(required.table_name || '.' || required.column_name)
    into missing_columns
  from (values
    ('appointments', 'business_id'),
    ('appointments', 'service_id'),
    ('appointments', 'location_id'),
    ('appointments', 'staff_id'),
    ('appointments', 'customer_name'),
    ('appointments', 'customer_phone'),
    ('appointments', 'appointment_date'),
    ('appointments', 'start_time'),
    ('appointments', 'end_time'),
    ('appointments', 'duration_minutes'),
    ('appointments', 'price'),
    ('appointments', 'status'),
    ('businesses', 'is_active'),
    ('businesses', 'is_published'),
    ('services', 'business_id'),
    ('services', 'is_active'),
    ('locations', 'business_id'),
    ('locations', 'is_active'),
    ('staff', 'business_id'),
    ('staff', 'is_active')
  ) as required(table_name, column_name)
  where not exists (
    select 1
    from information_schema.columns actual
    where actual.table_schema = 'public'
      and actual.table_name = required.table_name
      and actual.column_name = required.column_name
  );

  if missing_columns is not null then
    raise exception 'Active schema is missing required columns: %', array_to_string(missing_columns, ', ');
  end if;

  if exists (
    select 1
    from information_schema.columns actual
    where actual.table_schema = 'public'
      and actual.table_name = 'appointments'
      and actual.column_name in ('service_id', 'location_id', 'staff_id')
      and actual.is_nullable <> 'YES'
  ) then
    raise exception 'Expected appointments.service_id, location_id, and staff_id to remain nullable.';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'appointments'
      and permissive = 'RESTRICTIVE'
      and cmd in ('SELECT', 'INSERT', 'ALL')
      and policyname not in (
        'Appointment rows are private to their business owner',
        'Appointment rows are private to their business admins'
      )
  ) then
    raise exception 'Unreviewed restrictive appointments SELECT/INSERT policy exists. Inspect pg_policies and reconcile it before applying this migration so it does not block business admins or guest inserts.';
  end if;
end
$$;

create or replace function public.get_public_appointment_availability(
  p_business_id uuid,
  p_appointment_date date
)
returns table (start_time time, duration_minutes integer)
language sql
stable
security definer
set search_path = ''
as $function$
  select a.start_time, a.duration_minutes
  from public.appointments as a
  join public.businesses as b on b.id = a.business_id
  where a.business_id = p_business_id
    and a.appointment_date = p_appointment_date
    and p_appointment_date >= current_date
    and a.status in ('pending', 'confirmed')
    and b.is_active
    and b.is_published;
$function$;

revoke all on function public.get_public_appointment_availability(uuid, date) from public;
grant execute on function public.get_public_appointment_availability(uuid, date) to anon, authenticated;

-- Anonymous customers can only create appointments.
REVOKE ALL ON TABLE public.appointments FROM PUBLIC, anon;
GRANT INSERT ON TABLE public.appointments TO anon;

-- Authenticated business users retain their required permissions.
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.appointments TO authenticated;

alter table public.appointments enable row level security;

-- Remove only the two SELECT policies previously created by this migration.
-- Other permissive policies may remain; the restrictive owner-only policy
-- below prevents them from exposing rows to non-admins.
drop policy if exists "Business owners can read their appointments" on public.appointments;
drop policy if exists "Appointment rows are private to their business owner" on public.appointments;
drop policy if exists "Business owners and admins can read appointments" on public.appointments;
drop policy if exists "Appointment rows are private to their business admins" on public.appointments;

create policy "Business owners and admins can read appointments"
  on public.appointments
  for select
  to authenticated
  using (public.is_business_admin(appointments.business_id));

-- Restrictive policies are ANDed with every permissive SELECT policy. This
-- blocks anon even if a separate permissive public-read policy exists, while
-- preserving creator and owner/admin membership access through the helper.
create policy "Appointment rows are private to their business admins"
  on public.appointments
  as restrictive
  for select
  to public
  using (
    auth.uid() is not null
    and public.is_business_admin(appointments.business_id)
  );

drop policy if exists "Anyone can create pending appointments" on public.appointments;

create policy "Anyone can create pending appointments"
  on public.appointments
  for insert
  to anon, authenticated
  with check (
    status = 'pending'
    and appointment_date is not null
    and appointment_date >= current_date
    and start_time is not null
    and end_time is not null
    and end_time > start_time
    and duration_minutes is not null
    and duration_minutes > 0
    and price is not null
    and price >= 0
    and customer_name is not null
    and length(btrim(customer_name)) > 0
    and customer_phone is not null
    and length(regexp_replace(customer_phone, '[^0-9]', '', 'g')) >= 7
    and exists (
      select 1
      from public.businesses as b
      where b.id = appointments.business_id
        and b.is_active
        and b.is_published
    )
    and (
      appointments.service_id is null
      or exists (
        select 1
        from public.services as s
        where s.id = appointments.service_id
          and s.business_id = appointments.business_id
          and s.is_active
      )
    )
    and (
      appointments.location_id is null
      or exists (
        select 1
        from public.locations as l
        where l.id = appointments.location_id
          and l.business_id = appointments.business_id
          and l.is_active
      )
    )
    and (
      appointments.staff_id is null
      or exists (
        select 1
        from public.staff as st
        where st.id = appointments.staff_id
          and st.business_id = appointments.business_id
          and st.is_active
      )
    )
  );

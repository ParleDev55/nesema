-- ═══════════════════════════════════════════════════════════════════════════════
-- Super admin migration
-- Run in the Supabase SQL editor before deploying the admin system
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Update profiles.role constraint to include 'admin' ─────────────────────
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('practitioner', 'patient', 'admin'));

-- ── 2. Add suspended flag to profiles ────────────────────────────────────────
alter table public.profiles
  add column if not exists suspended boolean default false;

-- ── 3. Admin audit log ────────────────────────────────────────────────────────
create table if not exists public.admin_audit_log (
  id          uuid primary key default uuid_generate_v4(),
  admin_id    uuid references public.profiles on delete set null,
  action      text not null,
  target_type text,
  target_id   uuid,
  metadata    jsonb,
  created_at  timestamptz default now()
);

alter table public.admin_audit_log enable row level security;

create policy "Admins can view audit log"
  on public.admin_audit_log for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can insert audit log"
  on public.admin_audit_log for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ── 4. Platform settings (single-row config) ──────────────────────────────────
create table if not exists public.platform_settings (
  id                         uuid primary key default uuid_generate_v4(),
  allow_practitioner_signup  boolean default true,
  allow_patient_signup       boolean default true,
  maintenance_mode           boolean default false,
  updated_at                 timestamptz default now(),
  updated_by                 uuid references public.profiles on delete set null
);

-- Seed initial row if not present
insert into public.platform_settings (id)
  select uuid_generate_v4()
  where not exists (select 1 from public.platform_settings);

alter table public.platform_settings enable row level security;

create policy "Admins can manage platform settings"
  on public.platform_settings for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Allow reading settings from service role (used in middleware)
create policy "Service role can read platform settings"
  on public.platform_settings for select using (true);

-- ── 5. Admin bypass RLS policies ──────────────────────────────────────────────
-- IMPORTANT: the profiles check is done via a SECURITY DEFINER function to
-- avoid recursive RLS (the profiles policy cannot subquery profiles itself).
create or replace function public.is_admin()
  returns boolean
  language sql
  security definer
  stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- profiles — uses the non-recursive helper
create policy "Admins have full access"
  on public.profiles for all using (public.is_admin());

-- practitioners
create policy "Admins have full access"
  on public.practitioners for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- patients
create policy "Admins have full access"
  on public.patients for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- appointments
create policy "Admins have full access"
  on public.appointments for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- check_ins
create policy "Admins have full access"
  on public.check_ins for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- care_plans
create policy "Admins have full access"
  on public.care_plans for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- meal_plans
create policy "Admins have full access"
  on public.meal_plans for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- documents
create policy "Admins have full access"
  on public.documents for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- messages
create policy "Admins have full access"
  on public.messages for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- notifications
create policy "Admins have full access"
  on public.notifications for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- education_content
create policy "Admins have full access"
  on public.education_content for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- education_assignments
create policy "Admins have full access"
  on public.education_assignments for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- availability
create policy "Admins have full access"
  on public.availability for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Migration: GHL CRM integration
-- Store GHL contact IDs so we can update contacts without re-creating them

alter table public.profiles
  add column if not exists ghl_contact_id text;

alter table public.practitioners
  add column if not exists ghl_opportunity_id text;

alter table public.patients
  add column if not exists ghl_opportunity_id text;

-- GHL sync log for debugging
create table if not exists public.ghl_sync_log (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid references public.profiles on delete set null,
  event_type     text not null,
  ghl_contact_id text,
  payload        jsonb,
  response       jsonb,
  success        boolean default true,
  error          text,
  created_at     timestamptz default now()
);

alter table public.ghl_sync_log enable row level security;

create policy "Admins can view sync log"
  on public.ghl_sync_log for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Index for efficient log queries
create index if not exists ghl_sync_log_user_created
  on public.ghl_sync_log (user_id, created_at desc);

create index if not exists ghl_sync_log_event_type
  on public.ghl_sync_log (event_type, created_at desc);

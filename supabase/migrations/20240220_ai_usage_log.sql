-- Migration: Create ai_usage_log table for AI rate limiting and admin analytics

create table if not exists public.ai_usage_log (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid references public.profiles on delete cascade,
  feature    text not null,
  created_at timestamptz default now()
);

alter table public.ai_usage_log enable row level security;

create policy "Users can insert own usage"
  on public.ai_usage_log for insert
  with check (user_id = auth.uid());

create policy "Users can view own usage"
  on public.ai_usage_log for select
  using (user_id = auth.uid());

create policy "Admins can view all usage"
  on public.ai_usage_log for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Index for efficient rate-limit queries
create index if not exists ai_usage_log_user_created
  on public.ai_usage_log (user_id, created_at desc);

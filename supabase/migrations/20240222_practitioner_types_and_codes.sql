-- ─── Practitioner types (admin-managed discipline list) ──────────────────────

create table if not exists public.practitioner_types (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null unique,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz default now(),
  created_by  uuid references public.profiles on delete set null
);

alter table public.practitioner_types enable row level security;

-- Anyone (including unauthenticated users on the signup page) can read active types
create policy "Public read active practitioner_types"
  on public.practitioner_types for select
  using (is_active = true);

-- Admins have full access (bypasses the is_active filter above via admin policy)
create policy "Admin full access practitioner_types"
  on public.practitioner_types for all
  using (is_admin());

-- Seed the 9 disciplines that were previously hardcoded in the onboarding page
insert into public.practitioner_types (name, sort_order) values
  ('Functional Nutritionist', 1),
  ('Physiotherapist',         2),
  ('Sleep Coach',             3),
  ('Personal Trainer',        4),
  ('Naturopath',              5),
  ('Psychotherapist',         6),
  ('Osteopath',               7),
  ('Acupuncturist',           8),
  ('Health Coach',            9)
on conflict (name) do nothing;

-- ─── Discount codes ───────────────────────────────────────────────────────────

create table if not exists public.discount_codes (
  id              uuid primary key default uuid_generate_v4(),
  code            text not null unique,
  description     text,
  discount_type   text not null check (discount_type in ('percentage', 'fixed')),
  discount_value  numeric(10,2) not null check (discount_value > 0),
  max_uses        integer check (max_uses > 0),   -- null = unlimited
  uses_count      integer not null default 0,
  valid_from      timestamptz default now(),
  valid_until     timestamptz,                    -- null = no expiry
  is_active       boolean not null default true,
  applies_to      text not null default 'all' check (applies_to in ('all', 'initial', 'followup')),
  created_at      timestamptz default now(),
  created_by      uuid references public.profiles on delete set null
);

alter table public.discount_codes enable row level security;

create policy "Admin full access discount_codes"
  on public.discount_codes for all
  using (is_admin());

create policy "Public read active discount_codes"
  on public.discount_codes for select
  using (is_active = true);

-- ─── Referral codes ───────────────────────────────────────────────────────────

create table if not exists public.referral_codes (
  id                    uuid primary key default uuid_generate_v4(),
  code                  text not null unique,
  description           text,
  -- What the referring patient receives
  referrer_reward_type  text not null default 'none'
    check (referrer_reward_type in ('percentage', 'fixed', 'none')),
  referrer_reward_value numeric(10,2) not null default 0,
  -- What the new (referred) patient receives
  referee_reward_type   text not null default 'none'
    check (referee_reward_type in ('percentage', 'fixed', 'none')),
  referee_reward_value  numeric(10,2) not null default 0,
  max_uses              integer check (max_uses > 0),   -- null = unlimited
  uses_count            integer not null default 0,
  valid_from            timestamptz default now(),
  valid_until           timestamptz,
  is_active             boolean not null default true,
  created_at            timestamptz default now(),
  created_by            uuid references public.profiles on delete set null
);

alter table public.referral_codes enable row level security;

create policy "Admin full access referral_codes"
  on public.referral_codes for all
  using (is_admin());

create policy "Public read active referral_codes"
  on public.referral_codes for select
  using (is_active = true);

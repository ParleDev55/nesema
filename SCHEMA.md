# Nesema — Database Schema

> Paste this SQL into the Supabase SQL editor to create all tables and policies.
> Run it once when setting up a new Supabase project.

---

## Step 1 — Enable extensions

```sql
create extension if not exists "uuid-ossp";
```

---

## Step 2 — Create tables

```sql
-- ─────────────────────────────────────────
-- PROFILES (every user, prac or patient)
-- ─────────────────────────────────────────
create table public.profiles (
  id             uuid references auth.users on delete cascade primary key,
  role           text not null check (role in ('practitioner', 'patient')),
  first_name     text,
  last_name      text,
  email          text,
  avatar_url     text,
  created_at     timestamptz default now()
);

-- ─────────────────────────────────────────
-- PRACTITIONERS
-- ─────────────────────────────────────────
create table public.practitioners (
  id                  uuid primary key default uuid_generate_v4(),
  profile_id          uuid references public.profiles on delete cascade not null unique,
  practice_name       text,
  discipline          text,
  registration_body   text,
  registration_number text,
  years_of_practice   text,
  bio                 text,
  verification_status text default 'pending' check (verification_status in ('pending', 'verified', 'rejected')),
  booking_slug        text unique,
  session_length_mins integer default 60,
  buffer_mins         integer default 10,
  allows_self_booking boolean default true,
  initial_fee         integer,  -- pence/cents
  followup_fee        integer,
  cancellation_hours  integer default 24,
  is_live             boolean default false,
  stripe_account_id   text,
  created_at          timestamptz default now()
);

-- ─────────────────────────────────────────
-- PRACTITIONER AVAILABILITY
-- ─────────────────────────────────────────
create table public.availability (
  id                uuid primary key default uuid_generate_v4(),
  practitioner_id   uuid references public.practitioners on delete cascade not null,
  day_of_week       integer not null check (day_of_week between 0 and 6), -- 0=Sunday
  start_time        time not null,
  end_time          time not null,
  is_active         boolean default true
);

-- ─────────────────────────────────────────
-- PATIENTS
-- ─────────────────────────────────────────
create table public.patients (
  id                   uuid primary key default uuid_generate_v4(),
  profile_id           uuid references public.profiles on delete cascade not null unique,
  practitioner_id      uuid references public.practitioners on delete set null,
  date_of_birth        date,
  current_health       text,
  diagnosed_conditions text,
  medications          text,
  allergies            text,
  goals                text[],
  success_vision       text,
  motivation_level     text check (motivation_level in ('exploring', 'ready', 'all_in')),
  diet_type            text,
  meals_per_day        text,
  avg_sleep            text,
  activity_level       text,
  support_preferences  text[],
  additional_notes     text,
  programme_start      date,
  programme_end        date,
  programme_weeks      integer default 10,
  created_at           timestamptz default now()
);

-- ─────────────────────────────────────────
-- APPOINTMENTS
-- ─────────────────────────────────────────
create table public.appointments (
  id                uuid primary key default uuid_generate_v4(),
  practitioner_id   uuid references public.practitioners on delete cascade not null,
  patient_id        uuid references public.patients on delete cascade not null,
  appointment_type  text not null check (appointment_type in ('initial', 'followup', 'review')),
  status            text default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  scheduled_at      timestamptz not null,
  duration_mins     integer not null,
  location_type     text default 'virtual' check (location_type in ('virtual', 'in_person')),
  daily_room_url    text,
  patient_notes     text,
  practitioner_notes text,
  amount_pence      integer,
  stripe_payment_id text,
  created_at        timestamptz default now()
);

-- ─────────────────────────────────────────
-- DAILY CHECK-INS
-- ─────────────────────────────────────────
create table public.check_ins (
  id                    uuid primary key default uuid_generate_v4(),
  patient_id            uuid references public.patients on delete cascade not null,
  checked_in_at         timestamptz default now(),
  mood_score            integer check (mood_score between 1 and 5),
  energy_score          integer check (energy_score between 1 and 10),
  sleep_hours           numeric(3,1),
  digestion_score       integer check (digestion_score between 1 and 10),
  symptoms              text[],
  supplements_taken     text[],
  notes                 text
);

-- ─────────────────────────────────────────
-- CARE PLANS
-- ─────────────────────────────────────────
create table public.care_plans (
  id                uuid primary key default uuid_generate_v4(),
  patient_id        uuid references public.patients on delete cascade not null,
  practitioner_id   uuid references public.practitioners on delete cascade not null,
  week_number       integer not null,
  goals             text[],
  supplements       jsonb,  -- [{name, dose, timing}]
  notes             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ─────────────────────────────────────────
-- MEAL PLANS
-- ─────────────────────────────────────────
create table public.meal_plans (
  id                uuid primary key default uuid_generate_v4(),
  patient_id        uuid references public.patients on delete cascade not null,
  practitioner_id   uuid references public.practitioners on delete cascade not null,
  week_number       integer,
  protocol_name     text,
  days              jsonb,  -- {mon: {breakfast: [], lunch: [], dinner: [], snacks: []}}
  notes             text,
  assigned_at       timestamptz default now(),
  created_at        timestamptz default now()
);

-- ─────────────────────────────────────────
-- DOCUMENTS
-- ─────────────────────────────────────────
create table public.documents (
  id                uuid primary key default uuid_generate_v4(),
  patient_id        uuid references public.patients on delete cascade,
  practitioner_id   uuid references public.practitioners on delete cascade,
  uploaded_by       uuid references public.profiles on delete set null,
  document_type     text check (document_type in ('lab_result', 'intake_form', 'consent', 'report', 'other')),
  title             text not null,
  storage_path      text not null,  -- Supabase Storage path
  is_lab_result     boolean default false,
  requires_pin      boolean default false,
  created_at        timestamptz default now()
);

-- ─────────────────────────────────────────
-- MESSAGES
-- ─────────────────────────────────────────
create table public.messages (
  id                uuid primary key default uuid_generate_v4(),
  sender_id         uuid references public.profiles on delete cascade not null,
  recipient_id      uuid references public.profiles on delete cascade not null,
  body              text not null,
  read_at           timestamptz,
  created_at        timestamptz default now()
);

-- ─────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────
create table public.notifications (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid references public.profiles on delete cascade not null,
  type              text not null,
  title             text not null,
  body              text,
  read              boolean default false,
  link              text,
  created_at        timestamptz default now()
);

-- ─────────────────────────────────────────
-- EDUCATION CONTENT
-- ─────────────────────────────────────────
create table public.education_content (
  id                uuid primary key default uuid_generate_v4(),
  practitioner_id   uuid references public.practitioners on delete cascade not null,
  title             text not null,
  content_type      text check (content_type in ('article', 'video', 'course')),
  category          text,
  duration_mins     integer,
  url               text,
  created_at        timestamptz default now()
);

create table public.education_assignments (
  id                uuid primary key default uuid_generate_v4(),
  content_id        uuid references public.education_content on delete cascade,
  patient_id        uuid references public.patients on delete cascade,
  assigned_at       timestamptz default now(),
  completed_at      timestamptz,
  progress          integer default 0  -- percentage 0-100
);
```

---

## Step 3 — Row Level Security

```sql
-- Enable RLS on all tables
alter table public.profiles             enable row level security;
alter table public.practitioners        enable row level security;
alter table public.availability         enable row level security;
alter table public.patients             enable row level security;
alter table public.appointments         enable row level security;
alter table public.check_ins            enable row level security;
alter table public.care_plans           enable row level security;
alter table public.meal_plans           enable row level security;
alter table public.documents            enable row level security;
alter table public.messages             enable row level security;
alter table public.notifications        enable row level security;
alter table public.education_content    enable row level security;
alter table public.education_assignments enable row level security;

-- ── Profiles ──
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- ── Practitioners ──
create policy "Practitioners can view and edit own record"
  on public.practitioners for all using (
    profile_id = auth.uid()
  );
create policy "Public can view verified practitioners for booking"
  on public.practitioners for select using (
    is_live = true and verification_status = 'verified'
  );

-- ── Availability ──
create policy "Practitioners manage own availability"
  on public.availability for all using (
    practitioner_id in (
      select id from public.practitioners where profile_id = auth.uid()
    )
  );
create policy "Public can view availability for booking"
  on public.availability for select using (true);

-- ── Patients ──
create policy "Patients can view and edit own record"
  on public.patients for all using (profile_id = auth.uid());
create policy "Practitioners can view their own patients"
  on public.patients for select using (
    practitioner_id in (
      select id from public.practitioners where profile_id = auth.uid()
    )
  );

-- ── Appointments ──
create policy "Practitioners see their appointments"
  on public.appointments for all using (
    practitioner_id in (
      select id from public.practitioners where profile_id = auth.uid()
    )
  );
create policy "Patients see their appointments"
  on public.appointments for select using (
    patient_id in (
      select id from public.patients where profile_id = auth.uid()
    )
  );

-- ── Check-ins ──
create policy "Patients manage their own check-ins"
  on public.check_ins for all using (
    patient_id in (select id from public.patients where profile_id = auth.uid())
  );
create policy "Practitioners view their patients check-ins"
  on public.check_ins for select using (
    patient_id in (
      select p.id from public.patients p
      join public.practitioners pr on p.practitioner_id = pr.id
      where pr.profile_id = auth.uid()
    )
  );

-- ── Care plans ──
create policy "Practitioners manage care plans for their patients"
  on public.care_plans for all using (
    practitioner_id in (select id from public.practitioners where profile_id = auth.uid())
  );
create policy "Patients view their own care plans"
  on public.care_plans for select using (
    patient_id in (select id from public.patients where profile_id = auth.uid())
  );

-- ── Meal plans ──
create policy "Practitioners manage meal plans for their patients"
  on public.meal_plans for all using (
    practitioner_id in (select id from public.practitioners where profile_id = auth.uid())
  );
create policy "Patients view their own meal plans"
  on public.meal_plans for select using (
    patient_id in (select id from public.patients where profile_id = auth.uid())
  );

-- ── Documents ──
create policy "Practitioners manage their patient documents"
  on public.documents for all using (
    practitioner_id in (select id from public.practitioners where profile_id = auth.uid())
  );
create policy "Patients view their own documents"
  on public.documents for select using (
    patient_id in (select id from public.patients where profile_id = auth.uid())
  );

-- ── Messages ──
create policy "Users can view messages they sent or received"
  on public.messages for select using (
    sender_id = auth.uid() or recipient_id = auth.uid()
  );
create policy "Users can send messages"
  on public.messages for insert with check (sender_id = auth.uid());

-- ── Notifications ──
create policy "Users see their own notifications"
  on public.notifications for all using (user_id = auth.uid());

-- ── Education ──
create policy "Practitioners manage their education content"
  on public.education_content for all using (
    practitioner_id in (select id from public.practitioners where profile_id = auth.uid())
  );
create policy "Patients view assigned education"
  on public.education_assignments for select using (
    patient_id in (select id from public.patients where profile_id = auth.uid())
  );
```

---

## Step 4 — Trigger: auto-create profile on sign-up

```sql
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'patient')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

---

## Step 5 — Storage buckets

Run in the Supabase dashboard under Storage → New Bucket:

| Bucket name | Public? | Use |
|---|---|---|
| `avatars` | Yes | Profile photos |
| `documents` | No | Lab results, intake forms, reports |
| `credentials` | No | Practitioner registration proof |

For the `documents` and `credentials` buckets, add a storage policy:
- Practitioners can upload to their own folder: `practitioner_id/filename`
- Patients can view documents in their own folder: `patient_id/filename`

---

## Key Data Relationships

```
auth.users
    └── profiles (1:1)
            ├── practitioners (1:1, if role = 'practitioner')
            │       ├── availability (1:many)
            │       ├── patients (1:many)
            │       ├── appointments (1:many)
            │       ├── care_plans (1:many)
            │       ├── meal_plans (1:many)
            │       └── education_content (1:many)
            └── patients (1:1, if role = 'patient')
                    ├── appointments (1:many)
                    ├── check_ins (1:many)
                    ├── care_plans (1:many)
                    ├── meal_plans (1:many)
                    └── documents (1:many)
```

---

## Generating TypeScript Types

After running the schema, generate types locally or via the Supabase CLI:

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.ts
```

This gives you full type safety for all Supabase queries throughout the app.

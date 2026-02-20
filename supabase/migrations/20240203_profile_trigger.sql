-- ─────────────────────────────────────────
-- Profile auto-creation trigger
-- Creates a profiles row whenever a new auth.users row is inserted.
-- The role is read from raw_user_meta_data (set during sign-up) and
-- defaults to 'patient' if not present.
-- ─────────────────────────────────────────

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

-- Drop first so this migration is safe to re-run
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

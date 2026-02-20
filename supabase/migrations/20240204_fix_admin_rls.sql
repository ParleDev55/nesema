-- ═══════════════════════════════════════════════════════════════════════════════
-- Fix recursive RLS on the profiles table
--
-- The "Admins have full access" policy added in 20240202_super_admin.sql checks
-- admin status via a subquery on `profiles` itself:
--
--   exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
--
-- When any user queries `profiles`, PostgreSQL evaluates this policy, which runs
-- another query on `profiles`, which evaluates the same policy again → infinite
-- recursion → error. This causes the profile fetch during sign-in to fail, so
-- users are never redirected to the dashboard.
--
-- Fix: a SECURITY DEFINER function executes as the function owner (bypasses RLS),
-- so the inner `profiles` lookup is never subject to the recursive policy.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Create a SECURITY DEFINER helper that checks admin role without RLS
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

-- 2. Drop the recursive policy on profiles
drop policy if exists "Admins have full access" on public.profiles;

-- 3. Recreate it using the non-recursive helper
create policy "Admins have full access"
  on public.profiles for all
  using (public.is_admin());

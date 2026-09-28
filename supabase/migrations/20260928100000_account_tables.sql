-- supabase/migrations/20260928100000_account_tables.sql
-- Shared account layer for ShopAI + Chukta (spec §4.1, §4.2).

-- 1. Link each shop to a Supabase Auth user (set by register / reset-password).
alter table public.shops add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

-- 2. JWT claim helpers used by every app-scoped RLS policy.
create or replace function public.jwt_app() returns text
language sql stable set search_path = '' as $$ select nullif(auth.jwt() ->> 'app', '') $$;

create or replace function public.jwt_shop_id() returns uuid
language sql stable set search_path = '' as $$ select nullif(auth.jwt() ->> 'shop_id', '')::uuid $$;

-- 3. Per-app entitlement.
create table if not exists public.app_subscriptions (
  shop_id    uuid not null references public.shops(id) on delete cascade,
  app        text not null check (app in ('shopai', 'chukta')),
  plan_type  text not null,
  is_active  boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (shop_id, app)
);

alter table public.app_subscriptions enable row level security;
revoke all on public.app_subscriptions from anon, authenticated;
grant select on public.app_subscriptions to authenticated;
create policy "owner reads own subscriptions" on public.app_subscriptions
  for select to authenticated using (shop_id = public.jwt_shop_id());

-- 4. Session → app mapping, read only by the token hook and service role.
create table if not exists public.app_sessions (
  session_id uuid primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  app        text not null check (app in ('shopai', 'chukta')),
  device_id  text,
  created_at timestamptz not null default now()
);
create index if not exists idx_app_sessions_user on public.app_sessions(user_id);
alter table public.app_sessions enable row level security;
revoke all on public.app_sessions from anon, authenticated;

-- 5. Payments know which app they pay for.
alter table public.payments add column if not exists app text not null default 'shopai'
  check (app in ('shopai', 'chukta'));

-- 6. Carry existing (test) shops' ShopAI plans over, then drop the legacy columns.
insert into public.app_subscriptions (shop_id, app, plan_type, is_active, expires_at)
select s.id, 'shopai', coalesce(s.plan_type, 'monthly'), true,
       coalesce(s.plan_expires_at, now() + interval '30 days')
from public.shops s
on conflict (shop_id, app) do nothing;

alter table public.shops drop column if exists plan_type;
alter table public.shops drop column if exists plan_expires_at;
alter table public.shops drop column if exists password_hash;

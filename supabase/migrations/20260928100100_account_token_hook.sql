-- supabase/migrations/20260928100100_account_token_hook.sql
-- Custom Access Token Hook: stamp app + shop_id into every access token (spec §4.4).

create or replace function public.custom_access_token_hook(event jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  claims jsonb := event -> 'claims';
  v_app  text;
  v_shop uuid;
begin
  select s.app into v_app
    from public.app_sessions s
   where s.session_id = nullif(claims ->> 'session_id', '')::uuid;

  select sh.id into v_shop
    from public.shops sh
   where sh.auth_user_id = (event ->> 'user_id')::uuid;

  if v_app is not null then
    claims := jsonb_set(claims, '{app}', to_jsonb(v_app));
  end if;
  if v_shop is not null then
    claims := jsonb_set(claims, '{shop_id}', to_jsonb(v_shop::text));
  end if;

  return jsonb_set(event, '{claims}', claims);
end $$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

grant select on public.app_sessions to supabase_auth_admin;
grant select (id, auth_user_id) on public.shops to supabase_auth_admin;
create policy "auth admin reads app_sessions" on public.app_sessions
  for select to supabase_auth_admin using (true);
create policy "auth admin reads shops" on public.shops
  for select to supabase_auth_admin using (true);

-- Revoke every session of a user (password reset, forced logout).
create or replace function public.revoke_user_sessions(p_user_id uuid) returns void
language sql security definer set search_path = '' as $$
  delete from auth.sessions where user_id = p_user_id;
  delete from public.app_sessions where user_id = p_user_id;
$$;
revoke execute on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;

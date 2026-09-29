-- Admin shop list: how many active properties and active workers each shop has in Chukta. Counts only — no money.
create or replace function public.admin_chukta_counts()
returns table (shop_id uuid, property_count bigint, worker_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.shop_id, count(distinct p.id) as property_count, count(w.id) as worker_count
  from chukta.properties p
  left join chukta.workers w on w.property_id = p.id and w.status = 'active'
  where p.is_active
  group by p.shop_id
$$;

revoke execute on function public.admin_chukta_counts() from public, anon, authenticated;
grant execute on function public.admin_chukta_counts() to service_role;

-- Fix: attendance_entries has no voids_id; PL/pgSQL does not short-circuit `and`, so the combined
-- condition raised 42703 on every attendance insert. Guard the void check with a nested IF.
create or replace function chukta.check_entry_consistency() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_prop   uuid;
  v_worker uuid;
  v_void   uuid;
begin
  select w.property_id into v_prop from chukta.workers w where w.id = new.worker_id;
  if v_prop is distinct from new.property_id then
    raise exception 'worker % does not belong to property %', new.worker_id, new.property_id using errcode = '23514';
  end if;
  if tg_table_name in ('advance_entries', 'wage_payments') then
    if new.voids_id is not null then
      execute format('select property_id, worker_id, voids_id from chukta.%I where id = $1', tg_table_name)
        into v_prop, v_worker, v_void using new.voids_id;
      if v_prop is distinct from new.property_id or v_worker is distinct from new.worker_id or v_void is not null then
        raise exception 'invalid void target %', new.voids_id using errcode = '23514';
      end if;
    end if;
  end if;
  return new;
end $$;

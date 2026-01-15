-- Add RPC helper for atomic stock adjustments
-- Date: 2026-01-15
-- Purpose: Prevent negative stock + reduce race conditions when deducting/restoring materials
--
-- Usage from client:
--   select pin_adjust_material_stock(p_material_id := '<uuid>', p_delta := -1);
--
-- Notes:
-- - Only granted to authenticated
-- - Uses row-level lock (FOR UPDATE)

create or replace function public.pin_adjust_material_stock(
  p_material_id uuid,
  p_delta numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current numeric;
  v_next numeric;
begin
  select stock into v_current
  from public.pin_materials
  where id = p_material_id
  for update;

  if not found then
    raise exception 'Material not found: %', p_material_id;
  end if;

  v_next := coalesce(v_current, 0) + coalesce(p_delta, 0);

  if v_next < 0 then
    raise exception 'Insufficient stock (current=%, delta=%)', v_current, p_delta;
  end if;

  update public.pin_materials
  set stock = v_next,
      updated_at = now()
  where id = p_material_id;

  return v_next;
end;
$$;

revoke all on function public.pin_adjust_material_stock(uuid, numeric) from public;
grant execute on function public.pin_adjust_material_stock(uuid, numeric) to authenticated;

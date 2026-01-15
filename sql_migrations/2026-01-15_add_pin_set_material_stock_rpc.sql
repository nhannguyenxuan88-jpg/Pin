-- Atomic “set stock” helper for inventory adjustments.
-- Locks the material row to prevent races and ensures stock never goes negative.

CREATE OR REPLACE FUNCTION public.pin_set_material_stock(
  p_material_id uuid,
  p_new_stock numeric
)
RETURNS TABLE(before_stock numeric, after_stock numeric)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_before numeric;
BEGIN
  IF p_new_stock IS NULL THEN
    RAISE EXCEPTION 'p_new_stock is required';
  END IF;

  IF p_new_stock < 0 THEN
    RAISE EXCEPTION 'Stock cannot be negative';
  END IF;

  SELECT stock
  INTO v_before
  FROM public.pin_materials
  WHERE id = p_material_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material not found';
  END IF;

  UPDATE public.pin_materials
  SET stock = p_new_stock,
      updated_at = NOW()
  WHERE id = p_material_id;

  before_stock := COALESCE(v_before, 0);
  after_stock := p_new_stock;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pin_set_material_stock(uuid, numeric) TO authenticated;

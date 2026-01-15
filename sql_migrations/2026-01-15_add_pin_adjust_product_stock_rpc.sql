-- Atomic product stock adjustment helper.
-- Locks the product row to prevent races and ensures stock never goes negative.

CREATE OR REPLACE FUNCTION public.pin_adjust_product_stock(
  p_product_id uuid,
  p_delta numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current numeric;
  v_next numeric;
BEGIN
  IF p_delta IS NULL THEN
    RAISE EXCEPTION 'p_delta is required';
  END IF;

  SELECT stock
  INTO v_current
  FROM public.pin_products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  v_next := COALESCE(v_current, 0) + p_delta;

  IF v_next < 0 THEN
    RAISE EXCEPTION 'Insufficient product stock';
  END IF;

  UPDATE public.pin_products
  SET stock = v_next,
      updated_at = NOW()
  WHERE id = p_product_id;

  RETURN v_next;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pin_adjust_product_stock(uuid, numeric) TO authenticated;

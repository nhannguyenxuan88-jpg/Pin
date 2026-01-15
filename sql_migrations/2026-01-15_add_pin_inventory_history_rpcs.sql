-- Inventory atomic adjust + history logging RPCs.
-- These are used to keep sales/export flows consistent and auditable.

-- =====================================================
-- Materials: adjust stock + write pin_stock_history
-- =====================================================
CREATE OR REPLACE FUNCTION public.pin_adjust_material_stock_with_history(
  p_material_id uuid,
  p_delta numeric,
  p_transaction_type text,
  p_reason text,
  p_invoice_number text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_before numeric;
  v_after numeric;
BEGIN
  IF p_delta IS NULL THEN
    RAISE EXCEPTION 'p_delta is required';
  END IF;

  IF p_transaction_type IS NULL OR p_transaction_type NOT IN ('import','export','adjustment') THEN
    RAISE EXCEPTION 'Invalid transaction_type';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'p_reason is required';
  END IF;

  SELECT stock
    INTO v_before
    FROM public.pin_materials
   WHERE id = p_material_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material not found';
  END IF;

  v_after := COALESCE(v_before, 0) + p_delta;
  IF v_after < 0 THEN
    RAISE EXCEPTION 'Insufficient stock';
  END IF;

  UPDATE public.pin_materials
     SET stock = v_after,
         updated_at = NOW()
   WHERE id = p_material_id;

  INSERT INTO public.pin_stock_history(
    material_id,
    transaction_type,
    quantity_before,
    quantity_change,
    quantity_after,
    reason,
    invoice_number,
    note,
    created_by
  ) VALUES (
    p_material_id,
    p_transaction_type,
    v_before,
    p_delta,
    v_after,
    p_reason,
    p_invoice_number,
    p_note,
    auth.uid()
  );

  RETURN v_after;
END;
$$;

REVOKE ALL ON FUNCTION public.pin_adjust_material_stock_with_history(uuid, numeric, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pin_adjust_material_stock_with_history(uuid, numeric, text, text, text, text) TO authenticated;

-- =====================================================
-- Products: create history table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.pin_product_stock_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.pin_products(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('import','export','adjustment')),
  quantity_before DECIMAL(15,3) NOT NULL DEFAULT 0,
  quantity_change DECIMAL(15,3) NOT NULL,
  quantity_after DECIMAL(15,3) NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  invoice_number TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_pin_product_stock_history_product_id ON public.pin_product_stock_history(product_id);
CREATE INDEX IF NOT EXISTS idx_pin_product_stock_history_created_at ON public.pin_product_stock_history(created_at DESC);

-- =====================================================
-- Products: adjust stock + write pin_product_stock_history
-- =====================================================
CREATE OR REPLACE FUNCTION public.pin_adjust_product_stock_with_history(
  p_product_id uuid,
  p_delta numeric,
  p_transaction_type text,
  p_reason text,
  p_invoice_number text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_before numeric;
  v_after numeric;
BEGIN
  IF p_delta IS NULL THEN
    RAISE EXCEPTION 'p_delta is required';
  END IF;

  IF p_transaction_type IS NULL OR p_transaction_type NOT IN ('import','export','adjustment') THEN
    RAISE EXCEPTION 'Invalid transaction_type';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'p_reason is required';
  END IF;

  SELECT stock
    INTO v_before
    FROM public.pin_products
   WHERE id = p_product_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  v_after := COALESCE(v_before, 0) + p_delta;
  IF v_after < 0 THEN
    RAISE EXCEPTION 'Insufficient product stock';
  END IF;

  UPDATE public.pin_products
     SET stock = v_after,
         updated_at = NOW()
   WHERE id = p_product_id;

  INSERT INTO public.pin_product_stock_history(
    product_id,
    transaction_type,
    quantity_before,
    quantity_change,
    quantity_after,
    reason,
    invoice_number,
    note,
    created_by
  ) VALUES (
    p_product_id,
    p_transaction_type,
    v_before,
    p_delta,
    v_after,
    p_reason,
    p_invoice_number,
    p_note,
    auth.uid()
  );

  RETURN v_after;
END;
$$;

REVOKE ALL ON FUNCTION public.pin_adjust_product_stock_with_history(uuid, numeric, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pin_adjust_product_stock_with_history(uuid, numeric, text, text, text, text) TO authenticated;

-- Update PIN shared fund balance to support: reset-to-zero now, then auto increase/decrease by new transactions

CREATE TABLE IF NOT EXISTS public.pin_shared_fund_baseline (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  cash_offset numeric(15,2) NOT NULL DEFAULT 0,
  bank_offset numeric(15,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed baseline only once from current PIN transactions so displayed balance starts at 0
INSERT INTO public.pin_shared_fund_baseline (id, cash_offset, bank_offset)
SELECT
  true,
  COALESCE(SUM(
    CASE
      WHEN lower(COALESCE(tx.payment_source_id, 'cash')) IN ('cash', 'tien_mat', 'tiền mặt')
      THEN CASE
        WHEN tx.amount < 0 OR lower(COALESCE(tx.type, '')) = 'expense'
          OR lower(COALESCE(tx.category, '')) IN (
            'inventory_purchase','purchase','materials','equipment','utilities',
            'salary','salaries','expense','other_expense','rent','marketing','transport','supplier_payment'
          )
        THEN -ABS(tx.amount)::numeric
        ELSE ABS(tx.amount)::numeric
      END
      ELSE 0
    END
  ), 0),
  COALESCE(SUM(
    CASE
      WHEN lower(COALESCE(tx.payment_source_id, '')) IN ('bank', 'ngan_hang', 'ngân hàng')
      THEN CASE
        WHEN tx.amount < 0 OR lower(COALESCE(tx.type, '')) = 'expense'
          OR lower(COALESCE(tx.category, '')) IN (
            'inventory_purchase','purchase','materials','equipment','utilities',
            'salary','salaries','expense','other_expense','rent','marketing','transport','supplier_payment'
          )
        THEN -ABS(tx.amount)::numeric
        ELSE ABS(tx.amount)::numeric
      END
      ELSE 0
    END
  ), 0)
FROM public.cashtransactions tx
WHERE
  (
    COALESCE(tx.notes, '') ILIKE '%#app:pin%'
    OR COALESCE(tx.notes, '') ILIKE '%#app:pincorp%'
    OR COALESCE(tx.sale_id, '') LIKE 'LTN-BH%'
  )
  AND COALESCE(tx.work_order_id, '') NOT LIKE 'LTN-SC%'
ON CONFLICT (id) DO UPDATE SET
  cash_offset = EXCLUDED.cash_offset,
  bank_offset = EXCLUDED.bank_offset,
  updated_at = now();

CREATE OR REPLACE VIEW public.pin_shared_fund_balance AS
WITH pin_tx AS (
  SELECT
    lower(COALESCE(tx.payment_source_id, 'cash')) AS source,
    CASE
      WHEN tx.amount < 0 OR lower(COALESCE(tx.type, '')) = 'expense'
        OR lower(COALESCE(tx.category, '')) IN (
          'inventory_purchase','purchase','materials','equipment','utilities',
          'salary','salaries','expense','other_expense','rent','marketing','transport','supplier_payment'
        )
      THEN -ABS(tx.amount)::numeric
      ELSE ABS(tx.amount)::numeric
    END AS signed_amount
  FROM public.cashtransactions tx
  WHERE
    (
      COALESCE(tx.notes, '') ILIKE '%#app:pin%'
      OR COALESCE(tx.notes, '') ILIKE '%#app:pincorp%'
      OR COALESCE(tx.sale_id, '') LIKE 'LTN-BH%'
    )
    AND COALESCE(tx.work_order_id, '') NOT LIKE 'LTN-SC%'
),
agg AS (
  SELECT
    COALESCE(SUM(CASE WHEN source IN ('cash', 'tien_mat', 'tiền mặt') THEN signed_amount ELSE 0 END), 0) AS raw_cash_balance,
    COALESCE(SUM(CASE WHEN source IN ('bank', 'ngan_hang', 'ngân hàng') THEN signed_amount ELSE 0 END), 0) AS raw_bank_balance
  FROM pin_tx
)
SELECT
  (agg.raw_cash_balance - COALESCE(base.cash_offset, 0))::numeric(15,2) AS cash_balance,
  (agg.raw_bank_balance - COALESCE(base.bank_offset, 0))::numeric(15,2) AS bank_balance,
  ((agg.raw_cash_balance - COALESCE(base.cash_offset, 0)) + (agg.raw_bank_balance - COALESCE(base.bank_offset, 0)))::numeric(15,2) AS actual_balance,
  now()::timestamptz AS updated_at
FROM agg
LEFT JOIN public.pin_shared_fund_baseline base ON base.id = true;

GRANT SELECT ON public.pin_shared_fund_balance TO authenticated;
GRANT SELECT ON public.pin_shared_fund_baseline TO authenticated;

-- Check whether PIN shared fund balances are reset to 0 in DB
-- Run this in Supabase SQL Editor and review result sets.

-- 1) Current displayed balance (from view used by app)
SELECT
  cash_balance,
  bank_balance,
  actual_balance,
  updated_at,
  (cash_balance = 0)::boolean AS is_cash_zero,
  (bank_balance = 0)::boolean AS is_bank_zero,
  (actual_balance = 0)::boolean AS is_actual_zero
FROM public.pin_shared_fund_balance;

-- 2) Baseline offsets (rebase marker)
SELECT
  id,
  cash_offset,
  bank_offset,
  created_at,
  updated_at
FROM public.pin_shared_fund_baseline;

-- 3) Raw PIN transaction balances before baseline subtraction (debug)
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
)
SELECT
  COALESCE(SUM(CASE WHEN source IN ('cash', 'tien_mat', 'tiền mặt') THEN signed_amount ELSE 0 END), 0)::numeric(15,2) AS raw_cash_balance,
  COALESCE(SUM(CASE WHEN source IN ('bank', 'ngan_hang', 'ngân hàng') THEN signed_amount ELSE 0 END), 0)::numeric(15,2) AS raw_bank_balance,
  (
    COALESCE(SUM(CASE WHEN source IN ('cash', 'tien_mat', 'tiền mặt') THEN signed_amount ELSE 0 END), 0)
    + COALESCE(SUM(CASE WHEN source IN ('bank', 'ngan_hang', 'ngân hàng') THEN signed_amount ELSE 0 END), 0)
  )::numeric(15,2) AS raw_actual_balance
FROM pin_tx;

-- 4) One-line status
WITH v AS (
  SELECT cash_balance, bank_balance, actual_balance
  FROM public.pin_shared_fund_balance
  LIMIT 1
)
SELECT
  CASE
    WHEN COALESCE(v.cash_balance, 0) = 0
     AND COALESCE(v.bank_balance, 0) = 0
     AND COALESCE(v.actual_balance, 0) = 0
    THEN 'OK: PIN fund is reset to 0'
    ELSE 'NOT_ZERO: PIN fund is not fully reset'
  END AS reset_status
FROM v;
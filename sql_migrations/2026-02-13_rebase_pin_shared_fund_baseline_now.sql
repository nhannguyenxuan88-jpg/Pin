-- Rebase current PIN fund baseline to NOW.
-- After running this script, pin_shared_fund_balance should return ~0 immediately,
-- and then move correctly with new PIN transactions.

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

SELECT * FROM public.pin_shared_fund_balance;

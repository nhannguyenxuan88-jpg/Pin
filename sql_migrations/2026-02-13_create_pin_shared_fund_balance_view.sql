-- PIN shared fund balance view (fixed to 0 for integration with Moto app)
-- Purpose: ensure DB source for PIN cash/bank balance always returns zero.

CREATE OR REPLACE VIEW public.pin_shared_fund_balance AS
SELECT
  0::numeric(15,2) AS cash_balance,
  0::numeric(15,2) AS bank_balance,
  0::numeric(15,2) AS actual_balance,
  NOW()::timestamptz AS updated_at;

GRANT SELECT ON public.pin_shared_fund_balance TO authenticated;

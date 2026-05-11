-- Migration: Add 'cancelled' to payment_status constraint for pin_sales
-- Date: 2026-05-11
-- Description: Allow 'cancelled' as a valid payment_status value for soft-cancelled sales

ALTER TABLE pin_sales
  DROP CONSTRAINT IF EXISTS pin_sales_payment_status_check;

ALTER TABLE pin_sales
  ADD CONSTRAINT pin_sales_payment_status_check
  CHECK (payment_status IN ('paid', 'partial', 'debt', 'installment', 'cancelled'));

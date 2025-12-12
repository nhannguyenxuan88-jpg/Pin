-- Migration: Add 'installment' to payment_status constraint for pin_sales
-- Date: 2025-12-12
-- Description: Allow 'installment' as a valid payment_status value for installment sales

-- Drop the existing constraint and add a new one with 'installment' included
ALTER TABLE pin_sales 
  DROP CONSTRAINT IF EXISTS pin_sales_payment_status_check;

ALTER TABLE pin_sales 
  ADD CONSTRAINT pin_sales_payment_status_check 
  CHECK (payment_status IN ('paid', 'partial', 'debt', 'installment'));

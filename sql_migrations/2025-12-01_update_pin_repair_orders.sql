-- Update pin_repair_orders table to add missing columns
-- Run this in Supabase SQL Editor

-- Add deposit_amount column if not exists
ALTER TABLE pin_repair_orders 
ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(14,2) DEFAULT 0;

-- Add due_date column if not exists
ALTER TABLE pin_repair_orders 
ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;

-- Update status check to include 'Chờ'
ALTER TABLE pin_repair_orders 
DROP CONSTRAINT IF EXISTS pin_repair_orders_status_check;

ALTER TABLE pin_repair_orders 
ADD CONSTRAINT pin_repair_orders_status_check 
CHECK (status IN ('Tiếp nhận', 'Chờ', 'Đang sửa', 'Đã sửa xong', 'Trả máy'));

-- Update payment_method check to include 'transfer' and 'card'
ALTER TABLE pin_repair_orders 
DROP CONSTRAINT IF EXISTS pin_repair_orders_payment_method_check;

ALTER TABLE pin_repair_orders 
ADD CONSTRAINT pin_repair_orders_payment_method_check 
CHECK (payment_method IS NULL OR payment_method IN ('cash', 'bank', 'transfer', 'card'));

-- Add index for payment_status
CREATE INDEX IF NOT EXISTS idx_pin_repair_orders_payment_status 
ON pin_repair_orders(payment_status);

-- Add index for customer_phone for faster lookups
CREATE INDEX IF NOT EXISTS idx_pin_repair_orders_customer_phone 
ON pin_repair_orders(customer_phone);

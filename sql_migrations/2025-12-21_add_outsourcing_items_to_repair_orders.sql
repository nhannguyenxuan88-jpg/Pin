-- Add outsourcing_items column to pin_repair_orders table
-- This stores third-party processing/ordering items as JSONB array

ALTER TABLE pin_repair_orders 
ADD COLUMN IF NOT EXISTS outsourcing_items JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN pin_repair_orders.outsourcing_items IS 'Danh sách gia công ngoài / đặt hàng bên thứ 3';

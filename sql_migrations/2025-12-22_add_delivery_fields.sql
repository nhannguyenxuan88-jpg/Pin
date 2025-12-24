-- Migration: Add COD Delivery fields to pin_sales table
-- Date: 2025-12-22
-- Description: Add delivery method, status, and related fields for COD shipping feature

-- Add delivery fields to pin_sales table
ALTER TABLE pin_sales ADD COLUMN IF NOT EXISTS delivery_method VARCHAR(20) DEFAULT 'pickup';
ALTER TABLE pin_sales ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(20);
ALTER TABLE pin_sales ADD COLUMN IF NOT EXISTS delivery_address TEXT;
ALTER TABLE pin_sales ADD COLUMN IF NOT EXISTS delivery_phone VARCHAR(20);
ALTER TABLE pin_sales ADD COLUMN IF NOT EXISTS delivery_note TEXT;
ALTER TABLE pin_sales ADD COLUMN IF NOT EXISTS shipper_id UUID;
ALTER TABLE pin_sales ADD COLUMN IF NOT EXISTS cod_amount NUMERIC(15,2) DEFAULT 0;
ALTER TABLE pin_sales ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(15,2) DEFAULT 0;
ALTER TABLE pin_sales ADD COLUMN IF NOT EXISTS estimated_delivery_date TIMESTAMPTZ;
ALTER TABLE pin_sales ADD COLUMN IF NOT EXISTS actual_delivery_date TIMESTAMPTZ;

-- Add check constraints
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_delivery_method'
  ) THEN
    ALTER TABLE pin_sales ADD CONSTRAINT check_delivery_method 
      CHECK (delivery_method IN ('pickup', 'delivery'));
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_delivery_status'
  ) THEN
    ALTER TABLE pin_sales ADD CONSTRAINT check_delivery_status 
      CHECK (delivery_status IN ('pending', 'preparing', 'shipping', 'delivered', 'cancelled'));
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pin_sales_delivery_status ON pin_sales(delivery_status);
CREATE INDEX IF NOT EXISTS idx_pin_sales_shipper_id ON pin_sales(shipper_id);
CREATE INDEX IF NOT EXISTS idx_pin_sales_delivery_date ON pin_sales(estimated_delivery_date);
CREATE INDEX IF NOT EXISTS idx_pin_sales_delivery_method ON pin_sales(delivery_method);

-- Add comment for documentation
COMMENT ON COLUMN pin_sales.delivery_method IS 'Delivery method: pickup (customer picks up) or delivery (ship to customer)';
COMMENT ON COLUMN pin_sales.delivery_status IS 'Delivery status: pending, preparing, shipping, delivered, cancelled';
COMMENT ON COLUMN pin_sales.cod_amount IS 'Cash on delivery amount to collect from customer';
COMMENT ON COLUMN pin_sales.shipping_fee IS 'Shipping/delivery fee';

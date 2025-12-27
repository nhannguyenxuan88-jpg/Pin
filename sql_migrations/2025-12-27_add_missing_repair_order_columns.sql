-- =====================================================
-- PIN REPAIR ORDERS - ADD MISSING COLUMNS FOR QUOTATION & MATERIALS TRACKING
-- =====================================================
-- Run this in Supabase SQL Editor
-- Date: 2025-12-27
-- Purpose: Fix 400 Bad Request error when updating repair orders
-- =====================================================

-- Materials deduction tracking
ALTER TABLE pin_repair_orders 
ADD COLUMN IF NOT EXISTS materials_deducted BOOLEAN DEFAULT FALSE;

ALTER TABLE pin_repair_orders 
ADD COLUMN IF NOT EXISTS materials_deducted_at TIMESTAMPTZ;

-- Quotation fields
ALTER TABLE pin_repair_orders 
ADD COLUMN IF NOT EXISTS quoted_at TIMESTAMPTZ;

ALTER TABLE pin_repair_orders 
ADD COLUMN IF NOT EXISTS quote_approved_at TIMESTAMPTZ;

ALTER TABLE pin_repair_orders 
ADD COLUMN IF NOT EXISTS quote_approved BOOLEAN DEFAULT FALSE;

ALTER TABLE pin_repair_orders 
ADD COLUMN IF NOT EXISTS quoted_materials_cost DECIMAL(15,2);

ALTER TABLE pin_repair_orders 
ADD COLUMN IF NOT EXISTS quoted_labor_cost DECIMAL(15,2);

ALTER TABLE pin_repair_orders 
ADD COLUMN IF NOT EXISTS quoted_total DECIMAL(15,2);

-- Material shortage tracking
ALTER TABLE pin_repair_orders 
ADD COLUMN IF NOT EXISTS has_material_shortage BOOLEAN DEFAULT FALSE;

ALTER TABLE pin_repair_orders 
ADD COLUMN IF NOT EXISTS linked_purchase_order_id TEXT;

-- Add index for materials_deducted for performance
CREATE INDEX IF NOT EXISTS idx_pin_repair_orders_materials_deducted 
ON pin_repair_orders(materials_deducted);

-- =====================================================
-- DONE! Now you can update repair orders with "Trả máy" status
-- =====================================================

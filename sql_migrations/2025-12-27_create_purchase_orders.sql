-- =====================================================
-- PIN PURCHASE ORDERS - ĐẶT HÀNG NHÀ CUNG CẤP
-- =====================================================
-- Run this in Supabase SQL Editor
-- Date: 2025-12-27
-- =====================================================

-- Bảng đơn đặt hàng
CREATE TABLE IF NOT EXISTS pin_purchase_orders (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code TEXT NOT NULL UNIQUE,           -- Mã đơn: PO-YYYYMMDD-###
  supplier_id TEXT,                    -- FK to pin_suppliers
  supplier_name TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','confirmed','partial','received','cancelled')),
  total_amount DECIMAL(15,2) DEFAULT 0,
  paid_amount DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  expected_date DATE,                  -- Ngày dự kiến nhận
  received_date DATE,                  -- Ngày thực nhận
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bảng chi tiết đơn đặt hàng
CREATE TABLE IF NOT EXISTS pin_purchase_order_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  purchase_order_id TEXT REFERENCES pin_purchase_orders(id) ON DELETE CASCADE,
  material_id TEXT,                    -- FK to pin_materials
  material_name TEXT NOT NULL,
  material_sku TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'Cái',
  unit_price DECIMAL(15,2) DEFAULT 0,
  total_price DECIMAL(15,2) DEFAULT 0,
  received_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON pin_purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON pin_purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created ON pin_purchase_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order ON pin_purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_material ON pin_purchase_order_items(material_id);

-- Enable RLS
ALTER TABLE pin_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE pin_purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for authenticated users)
CREATE POLICY "Enable all for authenticated users" ON pin_purchase_orders
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for authenticated users" ON pin_purchase_order_items
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- DONE! Chạy SQL này trong Supabase SQL Editor
-- =====================================================

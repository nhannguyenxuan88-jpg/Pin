-- =====================================================
-- PINCORP APP - DATABASE SCHEMA SETUP
-- =====================================================
-- Created: November 5, 2025
-- Database: Supabase (PostgreSQL)
-- Project: jvigqtcbtzaxmrdsbfru
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. PROFILES TABLE (Users)
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  login_phone TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  role TEXT DEFAULT 'employee' CHECK (role IN ('admin', 'manager', 'employee')),
  allowed_apps TEXT DEFAULT 'pincorp' CHECK (allowed_apps IN ('motocare', 'pincorp', 'both')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. PIN MATERIALS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS pin_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  sku TEXT UNIQUE NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  purchase_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  retail_price DECIMAL(15,2) DEFAULT 0,
  wholesale_price DECIMAL(15,2) DEFAULT 0,
  stock DECIMAL(15,3) NOT NULL DEFAULT 0,
  committed_quantity DECIMAL(15,3) DEFAULT 0,
  supplier TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. PIN MATERIAL HISTORY TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS pin_material_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_id UUID REFERENCES pin_materials(id) ON DELETE SET NULL,
  material_name TEXT NOT NULL,
  material_sku TEXT,
  quantity DECIMAL(15,3) NOT NULL,
  purchase_price DECIMAL(15,2) NOT NULL,
  total_cost DECIMAL(15,2) NOT NULL,
  supplier TEXT,
  import_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  user_id UUID REFERENCES profiles(id),
  user_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. PIN BOMS (Bill of Materials) TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS pin_boms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_name TEXT NOT NULL,
  product_sku TEXT UNIQUE NOT NULL,
  materials JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  estimated_cost DECIMAL(15,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. PIN PRODUCTION ORDERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS pin_production_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bom_id UUID REFERENCES pin_boms(id),
  product_name TEXT NOT NULL,
  quantity_produced DECIMAL(15,3) NOT NULL,
  status TEXT NOT NULL DEFAULT 'Đang chờ' 
    CHECK (status IN ('Đang chờ', 'Đang sản xuất', 'Hoàn thành', 'Đã nhập kho', 'Đã hủy')),
  materials_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
  additional_costs JSONB DEFAULT '[]'::jsonb,
  total_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
  notes TEXT,
  user_name TEXT,
  committed_materials JSONB DEFAULT '[]'::jsonb,
  actual_costs JSONB,
  cost_analysis JSONB,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 6. PIN PRODUCTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS pin_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  sku TEXT UNIQUE NOT NULL,
  stock DECIMAL(15,3) NOT NULL DEFAULT 0,
  cost_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  retail_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  wholesale_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 7. PIN CUSTOMERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS pin_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 8. PIN SALES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS pin_sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
  discount DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) NOT NULL,
  customer JSONB NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'bank')),
  payment_status TEXT DEFAULT 'paid' CHECK (payment_status IN ('paid', 'partial', 'debt', 'installment')),
  paid_amount DECIMAL(15,2),
  due_date TIMESTAMPTZ,
  user_id UUID REFERENCES profiles(id),
  user_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 9. PIN REPAIR ORDERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS pin_repair_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  device_name TEXT NOT NULL,
  issue_description TEXT NOT NULL,
  technician_name TEXT,
  status TEXT NOT NULL DEFAULT 'Tiếp nhận' 
    CHECK (status IN ('Tiếp nhận', 'Đang sửa', 'Đã sửa xong', 'Trả máy')),
  materials_used JSONB DEFAULT '[]'::jsonb,
  labor_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
  total DECIMAL(15,2) NOT NULL DEFAULT 0,
  notes TEXT,
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'unpaid', 'partial')),
  partial_payment_amount DECIMAL(15,2),
  payment_method TEXT CHECK (payment_method IN ('cash', 'bank')),
  payment_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 10. STORE SETTINGS TABLE (Optional)
-- =====================================================
CREATE TABLE IF NOT EXISTS store_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL DEFAULT 'PinCorp',
  address TEXT,
  phone TEXT,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_account_holder TEXT,
  branches JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default store settings
INSERT INTO store_settings (name, address, phone)
VALUES ('PinCorp', 'Địa chỉ công ty', '0123456789')
ON CONFLICT DO NOTHING;

-- =====================================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pin_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE pin_material_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE pin_boms ENABLE ROW LEVEL SECURITY;
ALTER TABLE pin_production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE pin_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE pin_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pin_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE pin_repair_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES - Allow all authenticated users
-- =====================================================

-- Profiles
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Pin Materials
CREATE POLICY "Allow all for pin_materials" ON pin_materials FOR ALL TO authenticated USING (true);

-- Pin Material History
CREATE POLICY "Allow all for pin_material_history" ON pin_material_history FOR ALL TO authenticated USING (true);

-- Pin BOMs
CREATE POLICY "Allow all for pin_boms" ON pin_boms FOR ALL TO authenticated USING (true);

-- Pin Production Orders
CREATE POLICY "Allow all for pin_production_orders" ON pin_production_orders FOR ALL TO authenticated USING (true);

-- Pin Products
CREATE POLICY "Allow all for pin_products" ON pin_products FOR ALL TO authenticated USING (true);

-- Pin Customers
CREATE POLICY "Allow all for pin_customers" ON pin_customers FOR ALL TO authenticated USING (true);

-- Pin Sales
CREATE POLICY "Allow all for pin_sales" ON pin_sales FOR ALL TO authenticated USING (true);

-- Pin Repair Orders
CREATE POLICY "Allow all for pin_repair_orders" ON pin_repair_orders FOR ALL TO authenticated USING (true);

-- Store Settings
CREATE POLICY "Allow all for store_settings" ON store_settings FOR ALL TO authenticated USING (true);

-- =====================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_pin_materials_sku ON pin_materials(sku);
CREATE INDEX IF NOT EXISTS idx_pin_materials_name ON pin_materials(name);
CREATE INDEX IF NOT EXISTS idx_pin_material_history_material_id ON pin_material_history(material_id);
CREATE INDEX IF NOT EXISTS idx_pin_material_history_import_date ON pin_material_history(import_date DESC);
CREATE INDEX IF NOT EXISTS idx_pin_boms_product_sku ON pin_boms(product_sku);
CREATE INDEX IF NOT EXISTS idx_pin_production_orders_status ON pin_production_orders(status);
CREATE INDEX IF NOT EXISTS idx_pin_production_orders_date ON pin_production_orders(creation_date DESC);
CREATE INDEX IF NOT EXISTS idx_pin_products_sku ON pin_products(sku);
CREATE INDEX IF NOT EXISTS idx_pin_customers_phone ON pin_customers(phone);
CREATE INDEX IF NOT EXISTS idx_pin_sales_date ON pin_sales(date DESC);
CREATE INDEX IF NOT EXISTS idx_pin_repair_orders_status ON pin_repair_orders(status);
CREATE INDEX IF NOT EXISTS idx_pin_repair_orders_date ON pin_repair_orders(creation_date DESC);

-- =====================================================
-- SETUP COMPLETE!
-- =====================================================
-- Run this script in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/jvigqtcbtzaxmrdsbfru/editor
-- =====================================================

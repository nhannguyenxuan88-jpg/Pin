-- Migration: Create installment plans table
-- Date: 2025-12-11
-- Description: Tạo bảng quản lý trả góp

-- Bảng kế hoạch trả góp
CREATE TABLE IF NOT EXISTS pin_installment_plans (
    id TEXT PRIMARY KEY,
    sale_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    down_payment DECIMAL(15,2) NOT NULL DEFAULT 0,
    terms INTEGER NOT NULL DEFAULT 6,
    monthly_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    interest_rate DECIMAL(5,2) DEFAULT 0,
    start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'overdue', 'cancelled')),
    remaining_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bảng các kỳ thanh toán
CREATE TABLE IF NOT EXISTS pin_installment_payments (
    id TEXT PRIMARY KEY,
    installment_plan_id TEXT NOT NULL REFERENCES pin_installment_plans(id) ON DELETE CASCADE,
    payment_number INTEGER NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'partial', 'overdue')),
    paid_amount DECIMAL(15,2) DEFAULT 0,
    paid_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_installment_plans_sale_id ON pin_installment_plans(sale_id);
CREATE INDEX IF NOT EXISTS idx_installment_plans_customer_id ON pin_installment_plans(customer_id);
CREATE INDEX IF NOT EXISTS idx_installment_plans_status ON pin_installment_plans(status);
CREATE INDEX IF NOT EXISTS idx_installment_payments_plan_id ON pin_installment_payments(installment_plan_id);
CREATE INDEX IF NOT EXISTS idx_installment_payments_status ON pin_installment_payments(status);
CREATE INDEX IF NOT EXISTS idx_installment_payments_due_date ON pin_installment_payments(due_date);

-- Enable RLS
ALTER TABLE pin_installment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE pin_installment_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies (allow all for authenticated users)
DROP POLICY IF EXISTS "Allow all for installment_plans" ON pin_installment_plans;
CREATE POLICY "Allow all for installment_plans" ON pin_installment_plans FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all for installment_payments" ON pin_installment_payments;
CREATE POLICY "Allow all for installment_payments" ON pin_installment_payments FOR ALL USING (true);

-- Add category column to pin_materials if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'pin_materials' AND column_name = 'category') THEN
        ALTER TABLE pin_materials ADD COLUMN category TEXT CHECK (category IN ('material', 'product', 'finished_goods'));
    END IF;
END $$;

-- Comments
COMMENT ON TABLE pin_installment_plans IS 'Bảng quản lý kế hoạch trả góp';
COMMENT ON TABLE pin_installment_payments IS 'Bảng các kỳ thanh toán trả góp';
COMMENT ON COLUMN pin_installment_plans.terms IS 'Số kỳ thanh toán (tháng)';
COMMENT ON COLUMN pin_installment_plans.status IS 'Trạng thái: active, completed, overdue, cancelled';

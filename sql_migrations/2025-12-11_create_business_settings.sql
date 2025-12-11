-- Migration: Create business settings table
-- Date: 2025-12-11
-- Description: Tạo bảng lưu thông tin doanh nghiệp

CREATE TABLE IF NOT EXISTS pin_business_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    business_name TEXT,
    business_address TEXT,
    business_phone TEXT,
    business_email TEXT,
    tax_code TEXT,
    bank_account TEXT,
    bank_name TEXT,
    bank_account_name TEXT,
    bank_qr_url TEXT,
    logo_url TEXT,
    invoice_footer TEXT,
    invoice_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default row if not exists
INSERT INTO pin_business_settings (id) 
VALUES ('default') 
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE pin_business_settings ENABLE ROW LEVEL SECURITY;

-- RLS policy - allow all for authenticated users
DROP POLICY IF EXISTS "Allow all for business_settings" ON pin_business_settings;
CREATE POLICY "Allow all for business_settings" ON pin_business_settings FOR ALL USING (true);

-- Comments
COMMENT ON TABLE pin_business_settings IS 'Bảng lưu thông tin doanh nghiệp để in hóa đơn';
COMMENT ON COLUMN pin_business_settings.tax_code IS 'Mã số thuế';
COMMENT ON COLUMN pin_business_settings.bank_qr_url IS 'URL hình ảnh QR code ngân hàng';

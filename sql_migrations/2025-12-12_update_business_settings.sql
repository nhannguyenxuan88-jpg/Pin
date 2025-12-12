-- Migration: Update business settings table with all fields
-- Date: 2025-12-12
-- Description: Thêm tất cả các trường còn thiếu cho bảng pin_business_settings

-- Add missing columns
ALTER TABLE pin_business_settings ADD COLUMN IF NOT EXISTS business_name_english TEXT;
ALTER TABLE pin_business_settings ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'household';
ALTER TABLE pin_business_settings ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE pin_business_settings ADD COLUMN IF NOT EXISTS ward TEXT;
ALTER TABLE pin_business_settings ADD COLUMN IF NOT EXISTS district TEXT;
ALTER TABLE pin_business_settings ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE pin_business_settings ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE pin_business_settings ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE pin_business_settings ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE pin_business_settings ADD COLUMN IF NOT EXISTS business_license TEXT;
ALTER TABLE pin_business_settings ADD COLUMN IF NOT EXISTS business_license_date TEXT;
ALTER TABLE pin_business_settings ADD COLUMN IF NOT EXISTS business_license_place TEXT;
ALTER TABLE pin_business_settings ADD COLUMN IF NOT EXISTS bank_branch TEXT;
ALTER TABLE pin_business_settings ADD COLUMN IF NOT EXISTS slogan TEXT;
ALTER TABLE pin_business_settings ADD COLUMN IF NOT EXISTS invoice_prefix TEXT;
ALTER TABLE pin_business_settings ADD COLUMN IF NOT EXISTS invoice_serial_format TEXT;
ALTER TABLE pin_business_settings ADD COLUMN IF NOT EXISTS invoice_footer_note TEXT;
ALTER TABLE pin_business_settings ADD COLUMN IF NOT EXISTS representative_name TEXT;
ALTER TABLE pin_business_settings ADD COLUMN IF NOT EXISTS representative_position TEXT;

-- Migrate old data if exists (rename old columns to new if needed)
UPDATE pin_business_settings 
SET address = COALESCE(address, business_address),
    phone = COALESCE(phone, business_phone),
    email = COALESCE(email, business_email)
WHERE id = 'default';

-- Comments for new columns
COMMENT ON COLUMN pin_business_settings.business_name_english IS 'Tên tiếng Anh';
COMMENT ON COLUMN pin_business_settings.business_type IS 'Loại hình: company, individual, household';
COMMENT ON COLUMN pin_business_settings.address IS 'Địa chỉ đầy đủ';
COMMENT ON COLUMN pin_business_settings.slogan IS 'Slogan/Khẩu hiệu';
COMMENT ON COLUMN pin_business_settings.invoice_footer_note IS 'Ghi chú cuối hóa đơn';

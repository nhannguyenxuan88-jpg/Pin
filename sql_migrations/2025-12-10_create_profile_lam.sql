-- Tạo profile cho user lam.tcag@gmail.com với quyền admin
-- Chạy trong Supabase SQL Editor

-- =====================================================
-- BƯỚC 1: Tạo profile cho user từ auth.users
-- =====================================================
INSERT INTO profiles (id, name, email, role, allowed_apps, status)
SELECT 
  id,
  COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1)) as name,
  email,
  'admin',
  'both',
  'active'
FROM auth.users 
WHERE email = 'lam.tcag@gmail.com'
ON CONFLICT (id) DO UPDATE SET
  role = 'admin',
  allowed_apps = 'both',
  status = 'active',
  updated_at = NOW();

-- Verify profile
SELECT * FROM profiles WHERE email = 'lam.tcag@gmail.com';

-- =====================================================
-- BƯỚC 2: Tạo function get_next_daily_sequence (nếu chưa có)
-- =====================================================
CREATE OR REPLACE FUNCTION get_next_daily_sequence(p_prefix TEXT)
RETURNS INTEGER AS $$
DECLARE
  today_str TEXT;
  today_prefix TEXT;
  max_seq INTEGER;
BEGIN
  -- Get today's date in YYYYMMDD format
  today_str := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
  today_prefix := p_prefix || '-' || today_str || '-%';
  
  -- Find the max sequence number for today
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(code FROM LENGTH(p_prefix || '-' || today_str || '-') + 1) AS INTEGER)
  ), 0)
  INTO max_seq
  FROM pin_sales
  WHERE code LIKE today_prefix;
  
  RETURN max_seq + 1;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- BƯỚC 3: Kiểm tra xem bảng pin_sales có đúng constraint không
-- Nếu user_id không tồn tại trong profiles, sẽ lỗi
-- =====================================================
-- Có thể cần disable constraint tạm thời hoặc đảm bảo user có profile

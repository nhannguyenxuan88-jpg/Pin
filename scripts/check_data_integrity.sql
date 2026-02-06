-- ============================================================
-- KIỂM TRA TOÀN VẸN DỮ LIỆU KHO
-- Chạy trên Supabase Dashboard → SQL Editor
-- ============================================================

-- ===== 1. VẬT LIỆU TRÙNG TÊN (Bug tạo duplicate) =====
-- Bug cũ: khi nhập hàng bằng tên có sẵn, hệ thống tạo bản ghi mới
-- thay vì cập nhật bản ghi cũ → stock bị tính sai
SELECT 
  LOWER(TRIM(name)) AS ten_chuan,
  COUNT(*) AS so_ban_ghi,
  STRING_AGG(id::text, ', ') AS cac_id,
  STRING_AGG(sku, ', ') AS cac_sku,
  STRING_AGG(stock::text, ', ') AS cac_stock,
  SUM(stock) AS tong_stock
FROM pin_materials
GROUP BY LOWER(TRIM(name))
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- ===== 2. STOCK ÂM (Không hợp lệ) =====
SELECT id, name, sku, stock, supplier
FROM pin_materials
WHERE stock < 0
ORDER BY stock ASC;

-- ===== 3. SO SÁNH STOCK VỚI TỔNG NHẬP TỪ LỊCH SỬ =====
-- Nếu stock > tổng nhập (và chưa có xuất kho) → có thể bị bug duplicate 
SELECT 
  m.id,
  m.name,
  m.sku,
  m.stock AS stock_hien_tai,
  COALESCE(h.tong_nhap, 0) AS tong_nhap_tu_lich_su,
  m.stock - COALESCE(h.tong_nhap, 0) AS chenh_lech
FROM pin_materials m
LEFT JOIN (
  SELECT material_id, SUM(quantity) AS tong_nhap
  FROM pin_material_history
  WHERE material_id IS NOT NULL
  GROUP BY material_id
) h ON h.material_id = m.id::text
WHERE m.stock > COALESCE(h.tong_nhap, 0)
  AND COALESCE(h.tong_nhap, 0) > 0
ORDER BY (m.stock - COALESCE(h.tong_nhap, 0)) DESC;

-- ===== 4. KIỂM TRA CỘT supplier_phone CÓ TỒN TẠI KHÔNG =====
-- Nếu không tồn tại → cần thêm migration
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pin_materials'
  AND column_name IN ('supplier_phone', 'category_id')
ORDER BY column_name;

-- ===== 5. LỊCH SỬ NHẬP MỒ CÔI (material_id không tồn tại) =====
-- Có thể do xóa vật liệu nhưng lịch sử không xóa theo
SELECT h.id, h.material_name, h.material_sku, h.quantity, h.import_date
FROM pin_material_history h
LEFT JOIN pin_materials m ON m.id::text = h.material_id
WHERE m.id IS NULL
  AND h.material_id IS NOT NULL
ORDER BY h.import_date DESC;

-- ===== 6. CÔNG NỢ NCC TREO (supplier không tồn tại) =====
SELECT d.*
FROM pin_supplier_debts d
WHERE d.status = 'pending'
ORDER BY d.created_at DESC;

-- ============================================================
-- SỬA DỮ LIỆU 
-- ============================================================

-- ===== SỬA 1: STOCK ÂM → đặt về 0 =====
UPDATE pin_materials 
SET stock = 0, updated_at = NOW()
WHERE stock < 0;

-- ===== SỬA 2: THÊM CỘT supplier_phone (chưa tồn tại) =====
ALTER TABLE pin_materials ADD COLUMN IF NOT EXISTS supplier_phone TEXT;

-- ===== SỬA 3: LIÊN KẾT LẠI LỊCH SỬ MỒ CÔI =====
-- Ghép lại orphan history records về material thật bằng material_sku hoặc material_name
-- Bước 3a: Xem trước những gì sẽ được sửa (CHẠY TRƯỚC ĐỂ KIỂM TRA)
SELECT 
  h.id AS history_id,
  h.material_id AS old_material_id,
  h.material_name,
  h.material_sku,
  m.id AS real_material_id,
  m.name AS real_name,
  CASE 
    WHEN m_sku.id IS NOT NULL THEN 'match by SKU'
    WHEN m_name.id IS NOT NULL THEN 'match by Name'
    ELSE 'NO MATCH'
  END AS match_type
FROM pin_material_history h
LEFT JOIN pin_materials m_check ON m_check.id::text = h.material_id
LEFT JOIN pin_materials m_sku ON m_sku.sku = h.material_sku
LEFT JOIN pin_materials m_name ON LOWER(TRIM(m_name.name)) = LOWER(TRIM(h.material_name))
LEFT JOIN LATERAL (
  SELECT COALESCE(m_sku.id, m_name.id) AS id, 
         COALESCE(m_sku.name, m_name.name) AS name
) m ON true
WHERE m_check.id IS NULL
  AND h.material_id IS NOT NULL
ORDER BY h.import_date DESC;

-- ===== SỬA 3b: Thực hiện cập nhật (CHẠY SAU KHI ĐÃ XEM TRƯỚC) =====
-- Ưu tiên match bằng SKU, nếu không thì match bằng tên

-- Cập nhật bằng SKU trước
UPDATE pin_material_history h
SET material_id = m.id::text
FROM pin_materials m
WHERE m.sku = h.material_sku
  AND h.material_sku IS NOT NULL
  AND h.material_sku != ''
  AND NOT EXISTS (
    SELECT 1 FROM pin_materials x WHERE x.id::text = h.material_id
  );

-- Sau đó cập nhật bằng tên cho những gì còn lại
UPDATE pin_material_history h
SET material_id = m.id::text
FROM pin_materials m
WHERE LOWER(TRIM(m.name)) = LOWER(TRIM(h.material_name))
  AND h.material_name IS NOT NULL
  AND h.material_name != ''
  AND NOT EXISTS (
    SELECT 1 FROM pin_materials x WHERE x.id::text = h.material_id
  );

-- ===== KIỂM TRA SAU KHI SỬA =====
-- Chạy lại query #5 để xem còn orphan không
SELECT COUNT(*) AS con_orphan
FROM pin_material_history h
LEFT JOIN pin_materials m ON m.id::text = h.material_id
WHERE m.id IS NULL
  AND h.material_id IS NOT NULL;

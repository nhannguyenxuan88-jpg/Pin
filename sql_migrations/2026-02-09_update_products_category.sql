-- Cập nhật category_id cho tất cả sản phẩm chưa có danh mục
-- Migration: 2026-02-09 - Gán danh mục mặc định cho thành phẩm

-- Đảm bảo category mặc định tồn tại
INSERT INTO pin_categories (id, name, description, type) VALUES
  ('cat-product-default', 'Thành phẩm', 'Sản phẩm hoàn chỉnh', 'product')
ON CONFLICT (id) DO NOTHING;

-- Cập nhật tất cả sản phẩm chưa có category_id
UPDATE pin_products 
SET category_id = 'cat-product-default' 
WHERE category_id IS NULL OR category_id = '';

-- Xác nhận kết quả
SELECT 
  COUNT(*) as total_products,
  COUNT(CASE WHEN category_id IS NOT NULL THEN 1 END) as products_with_category,
  COUNT(CASE WHEN category_id IS NULL THEN 1 END) as products_without_category
FROM pin_products;

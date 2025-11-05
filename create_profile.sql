-- Tạo profile cho user hiện có
INSERT INTO profiles (id, name, email, role, allowed_apps, status)
VALUES (
  'f24dedeb-e13b-4f09-9634-52a5fcb0e463',
  'Admin',
  'nhanxn@gmail.com',
  'admin',
  'pincorp',
  'active'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  allowed_apps = EXCLUDED.allowed_apps,
  status = EXCLUDED.status;

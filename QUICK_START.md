# 🚀 HƯỚNG DẪN KHỞI CHẠY NHANH

## Bước 1: Cài đặt Dependencies

```bash
cd c:\Users\HUAWEI\Documents\GitHub\PinCorp-App
npm install
```

## Bước 2: Cấu hình Environment

Sao chép file cấu hình:
```bash
copy .env.example .env.local
```

Mở file `.env.local` và cập nhật thông tin Supabase:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Lấy thông tin Supabase:
1. Truy cập: https://app.supabase.com/
2. Chọn project của bạn
3. Vào Settings > API
4. Copy "Project URL" vào VITE_SUPABASE_URL
5. Copy "anon public" key vào VITE_SUPABASE_ANON_KEY

## Bước 3: Chạy Ứng Dụng

```bash
npm run dev
```

Ứng dụng sẽ mở tại: **http://localhost:3002**

## 🔧 Lệnh Hữu Ích

- **Development**: `npm run dev`
- **Build Production**: `npm run build`
- **Preview Production**: `npm run preview`

## 📝 Lưu Ý

- Port mặc định: **3002** (khác với MotoCarePro chạy port 3001)
- File `.env.local` không được commit vào Git
- Cần có tài khoản Supabase và database đã được setup

## 🐛 Nếu Gặp Lỗi

### "Running in offline mode"
➡️ Chưa cấu hình `.env.local` hoặc credentials không đúng

### Module not found
➡️ Chạy lại: `npm install`

### Port already in use
➡️ Đổi port trong `vite.config.ts`

---

**Chúc bạn làm việc hiệu quả với PinCorp App! 🎉**

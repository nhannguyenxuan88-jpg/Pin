# 🚀 HƯỚNG DẪN CHẠY MOBILE APP - NHANH

## ⚡ Quick Start (5 phút)

### Bước 1: Chuẩn bị Supabase Credentials

Mở file `D:\Pin\Pin\supabaseClient.ts` và copy 2 giá trị:

```typescript
const supabaseUrl = "https://xxx.supabase.co"; // ← Copy cái này
const supabaseAnonKey = "eyJxxx..."; // ← Copy cái này
```

### Bước 2: Cấu hình Mobile App

Mở file `D:\Pin-Mobile\src\config\supabase.ts`:

```typescript
// Thay đổi 2 dòng này:
const SUPABASE_URL = "https://xxx.supabase.co"; // ← Paste vào đây
const SUPABASE_ANON_KEY = "eyJxxx..."; // ← Paste vào đây
```

**Lưu file!**

### Bước 3: Chạy App

```powershell
cd D:\Pin-Mobile
npm start
```

### Bước 4: Mở trên điện thoại

1. **Cài Expo Go** từ Play Store (Android) hoặc App Store (iOS)
2. **Quét QR code** hiện ra trên terminal
3. **Chờ app load** (~10-30 giây lần đầu)
4. **Done!** 🎉

---

## 📱 Test Login

Sử dụng tài khoản từ web app:

```
Email: admin@pincorp.com
Password: ********
```

Hoặc tài khoản bạn đã tạo trên web.

---

## 🎯 Features để test

### 1. Login Screen

- ✅ Nhập email + password
- ✅ Click "Đăng nhập"
- ✅ Xem loading spinner
- ✅ Tự động chuyển sang Home

### 2. Home Screen (Tab 1)

- ✅ Xem stats cards (mock data)
- ✅ Quick actions buttons
- ✅ Recent activity
- ✅ Pull to refresh

### 3. Products Screen (Tab 2)

- ✅ Xem danh sách sản phẩm REAL từ database
- ✅ Tìm kiếm sản phẩm
- ✅ Xem stock status colors
- ✅ Pull to refresh

### 4. Profile Screen (Tab 5)

- ✅ Xem thông tin user
- ✅ Settings menu
- ✅ Đăng xuất

---

## 🐛 Nếu gặp lỗi

### Lỗi: "Cannot find module @expo/vector-icons"

```bash
cd D:\Pin-Mobile
npx expo install @expo/vector-icons
```

### Lỗi: "Supabase connection failed"

→ Kiểm tra lại SUPABASE_URL và SUPABASE_ANON_KEY

### Lỗi: "QR code không scan được"

→ Thử tunnel mode:

```bash
npx expo start --tunnel
```

### App không load products

→ Kiểm tra:

1. Internet connection
2. Supabase project có đang chạy không
3. Table `pin_products` có data không

---

## 💡 Tips

### Test trên Web (nhanh hơn)

```bash
npm run web
```

→ Mở browser: `http://localhost:8081`

### Clear cache nếu lỗi

```bash
npx expo start -c
```

### Xem logs

```bash
# Trong terminal, nhấn:
j  # Mở debugger
r  # Reload app
c  # Clear console
```

---

## 📊 Expected Results

### Products Screen nên show:

```
┌─────────────────────────────┐
│ Thép tấm 3mm                │
│ SKU: MAT001                 │
│ Giá bán: 150,000 đ         │
│ Giá vốn: 120,000 đ         │
│ [95] ● Còn hàng            │
└─────────────────────────────┘
```

### Home Screen nên show:

```
┌──────────────────────┐
│ Xin chào, admin      │
│                      │
│ ┌─────┐ ┌─────┐    │
│ │12.5M│ │  23 │    │ (Stats cards)
│ └─────┘ └─────┘    │
│                      │
│ [Bán hàng] [Quét mã]│ (Quick actions)
└──────────────────────┘
```

---

## ✅ Checklist

Sau khi test, check xem:

- [ ] Login thành công
- [ ] Home screen hiển thị đúng
- [ ] Products load từ database
- [ ] Search hoạt động
- [ ] Navigation giữa tabs smooth
- [ ] Pull to refresh hoạt động
- [ ] Logout thành công
- [ ] Auto-login lần mở app tiếp theo

---

## 🚀 Next: Phase 3B

Khi Phase 3A ok, chúng ta sẽ tiếp tục:

1. **POS Interface** - Bán hàng
2. **Barcode Scanner** - Quét mã
3. **Materials Management** - Nguyên liệu
4. **CRUD Operations** - Thêm/Sửa/Xóa
5. **Offline Sync** - Làm việc offline

**Estimated:** 2 tuần nữa

---

## 📞 Need Help?

Check:

1. `README.md` trong `Pin-Mobile/`
2. `PHASE_3A_COMPLETE.md`
3. Hoặc hỏi dev team

---

**Happy Testing! 📱✨**

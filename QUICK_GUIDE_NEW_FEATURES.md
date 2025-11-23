# 🎉 TÍNH NĂNG MỚI - HƯỚNG DẪN SỬ DỤNG NHANH

## 📅 Cập nhật: 23/11/2025

Chào mừng bạn đến với **Phase 1** - 3 tính năng mới siêu hữu ích! 🚀

---

## 1️⃣ SAO LƯU & KHÔI PHỤC DỮ LIỆU 💾

### Tại sao quan trọng?

- 🛡️ Bảo vệ dữ liệu khỏi mất mát
- 📤 Chuyển dữ liệu giữa các máy tính
- 📊 Xuất báo cáo Excel để phân tích
- 💼 Lưu trữ snapshot cho audit

### Cách sử dụng:

#### Bước 1: Mở Quản lý Sao lưu

1. Click vào **"Danh bạ"** trên thanh menu
2. Chọn tab **"Sao lưu"** (icon 💾)
3. Click nút **"Mở Quản lý Sao lưu"**

#### Bước 2: Chọn loại backup

**📄 XUẤT JSON (Khuyến nghị cho backup đầy đủ)**

- ✅ Bao gồm TẤT CẢ dữ liệu
- ✅ Có thể IMPORT LẠI khi cần
- ✅ File nhỏ gọn, dễ lưu trữ
- 💡 Sử dụng khi: Backup hàng ngày, chuyển máy, khôi phục dữ liệu

**📊 XUẤT EXCEL/CSV (Dễ đọc, phân tích)**

- ✅ Nhiều file CSV cho từng module
- ✅ Mở bằng Excel/Google Sheets
- ✅ Dễ in ấn, chia sẻ
- 💡 Sử dụng khi: Báo cáo cuối tháng, phân tích dữ liệu

**⚡ SAO LƯU NHANH (LocalStorage)**

- ✅ Lưu ngay trên trình duyệt
- ✅ Không cần tải file
- ✅ Tự động giữ 7 bản gần nhất
- ⚠️ CHÚ Ý: Chỉ lưu trên trình duyệt này!

#### Bước 3: Khôi phục dữ liệu

1. Trong Quản lý Sao lưu, kéo xuống phần **"Nhập dữ liệu"**
2. Click vào ô "Khôi phục từ file JSON"
3. Chọn file backup (.json) đã tải xuống trước đó
4. Xác nhận thông tin backup
5. Click **"Có"** để khôi phục

⚠️ **CẢNH BÁO**: Khôi phục sẽ GHI ĐÈ dữ liệu hiện tại!

### 💡 Mẹo sử dụng:

- ✅ Backup HÀNG NGÀY trước khi đóng cửa
- ✅ Lưu file vào Google Drive/Dropbox
- ✅ Đặt tên file có ngày: `pincorp-backup-23-11-2025.json`
- ✅ Kiểm tra file backup định kỳ để đảm bảo có thể khôi phục

---

## 2️⃣ THÔNG BÁO THÔNG MINH 🔔

### Tự động cảnh báo:

- 📦 **Tồn kho thấp** - Khi nguyên liệu/sản phẩm sắp hết
- 💰 **Công nợ quá hạn** - Khi khách hàng chưa trả tiền đúng hạn
- ✅ **Sản xuất hoàn thành** - Khi lệnh SX hoàn tất

### Cách sử dụng:

#### Xem thông báo:

1. Nhìn lên **thanh menu phía trên**
2. Tìm icon **🔔 chuông**
3. Nếu có **số đỏ** → có thông báo chưa đọc
4. Click vào chuông để xem danh sách

#### Các thao tác:

- **Đọc thông báo**: Click vào thông báo → tự động chuyển đến trang liên quan
- **Đánh dấu đã đọc**: Click icon ✓ (check)
- **Xóa tất cả**: Click icon 🗑️ (thùng rác)

### Hiểu mức độ cảnh báo:

🔴 **NGUY HIỂM** (Critical)

- Tồn kho ≤ 10%
- Nợ quá hạn > 7 ngày
- ⚡ CẦN XỬ LÝ NGAY!

🟠 **CAO** (High)

- Tồn kho 10-20%
- Nợ quá hạn 1-7 ngày
- ⏰ Cần chú ý sớm

🟡 **TRUNG BÌNH** (Medium)

- Cảnh báo chung

🔵 **THẤP** (Low)

- Thông tin

### 💡 Mẹo sử dụng:

- ✅ Kiểm tra thông báo HÀNG NGÀY buổi sáng
- ✅ Xử lý cảnh báo 🔴 NGUY HIỂM trước
- ✅ Click vào thông báo để xem chi tiết và xử lý luôn
- ✅ Đánh dấu đã đọc sau khi xử lý xong

### ⚙️ Tùy chỉnh (Nâng cao):

Trong code, bạn có thể thay đổi:

```typescript
// Ngưỡng cảnh báo tồn kho
lowStockThreshold: 20,      // 20% = cảnh báo
criticalStockThreshold: 10, // 10% = nguy hiểm

// Bật/tắt các loại cảnh báo
enableLowStockAlerts: true,
enableDebtAlerts: true,
soundEnabled: true, // Âm thanh thông báo
```

---

## 3️⃣ TÌM KIẾM THÔNG MINH 🔍

### Tính năng nổi bật:

- 🎯 **Fuzzy Search**: Tìm gần đúng, không cần chính xác
- 🇻🇳 **Hỗ trợ tiếng Việt**: Tìm có dấu hay không dấu đều được
- 💾 **Lưu lịch sử**: Nhớ 20 lần tìm gần nhất
- ⭐ **Lưu bộ lọc**: Lưu filter hay dùng để tái sử dụng

### Ví dụ:

**Fuzzy Search (Tìm gần đúng):**

```
Tìm: "nguy lieu"
→ Kết quả: "Nguyên liệu", "Nguyên liệu kim loại", ...

Tìm: "khach hang"
→ Kết quả: "Khách hàng", "Khách hàng VIP", ...
```

**Vietnamese Support:**

```
Tìm: "banh xe"
→ Kết quả: "Bánh xe", "Bạnh xế", ...

Tìm: "dien thoai"
→ Kết quả: "Điện thoại", "Diện thoái", ...
```

### 💡 Cách tích hợp (Cho developer):

```typescript
import { createAdvancedSearchService } from "@/lib/services/AdvancedSearchService";

const searchService = createAdvancedSearchService();

// 1. Fuzzy search
const results = searchService.fuzzySearch(
  materials, // Danh sách items
  searchQuery, // Từ khóa tìm kiếm
  ["name", "sku"] // Các trường tìm kiếm
);

// 2. Lọc theo khoảng thời gian
const filtered = searchService.filterByDateRange(
  sales,
  "date",
  startDate,
  endDate
);

// 3. Tìm kiếm nhiều trường
const matches = searchService.multiFieldSearch(customers, {
  name: "nguyen",
  phone: "0123",
});

// 4. Lưu filter
searchService.saveFilter(
  "Nguyên liệu kim loại",
  { category: "metal", stock: ">100" },
  "Filter cho NL kim loại có stock > 100"
);

// 5. Load filter đã lưu
const savedFilters = searchService.getSavedFilters();
const myFilter = searchService.loadFilter(filterId);
```

---

## 📊 SO SÁNH TRƯỚC & SAU

### Trước khi có tính năng mới:

- ❌ Lo lắng mất dữ liệu
- ❌ Không biết khi nào hết hàng
- ❌ Phải nhớ công nợ thủ công
- ❌ Tìm kiếm phải chính xác 100%

### Sau khi có tính năng mới:

- ✅ Backup tự động, an tâm
- ✅ Cảnh báo tự động khi tồn kho thấp
- ✅ Nhắc nhở công nợ quá hạn
- ✅ Tìm gần đúng, dễ dàng hơn

---

## 🎯 CHECKLIST HÀNG NGÀY

### Buổi sáng (Mở cửa):

- [ ] Kiểm tra thông báo 🔔
- [ ] Xử lý cảnh báo 🔴 nguy hiểm
- [ ] Xem tồn kho thấp → nhập thêm

### Cuối ngày (Đóng cửa):

- [ ] Backup dữ liệu 💾
- [ ] Xem lại các thông báo còn tồn
- [ ] Lên kế hoạch xử lý ngày mai

### Cuối tuần:

- [ ] Backup full ra file JSON
- [ ] Lưu vào Google Drive
- [ ] Kiểm tra công nợ quá hạn
- [ ] Xem báo cáo tồn kho

### Cuối tháng:

- [ ] Export Excel để làm báo cáo
- [ ] Lưu trữ snapshot tháng
- [ ] Review các filter đã lưu
- [ ] Dọn dẹp thông báo cũ

---

## ❓ CÂU HỎI THƯỜNG GẶP

### Q: Backup lưu ở đâu?

**A:**

- **JSON Export**: File tải về máy tính (thư mục Downloads)
- **CSV Export**: Nhiều file CSV tải về
- **Auto Backup**: LocalStorage của trình duyệt

### Q: Mất file backup thì sao?

**A:** Nên lưu backup vào:

- ☁️ Google Drive / OneDrive / Dropbox
- 💾 USB / Ổ cứng ngoài
- 📧 Gửi email cho chính mình

### Q: Tại sao không thấy thông báo?

**A:** Kiểm tra:

- ✅ Có dữ liệu tồn kho thấp không?
- ✅ Có công nợ quá hạn không?
- ✅ Đợi 30 giây để hệ thống check
- ✅ Refresh trang (F5)

### Q: Thông báo quá nhiều làm sao?

**A:**

- Click **"Đánh dấu tất cả đã đọc"** (icon ✓)
- Hoặc **"Xóa tất cả"** (icon 🗑️)
- Xử lý các vấn đề (nhập kho, thu nợ) để giảm thông báo

### Q: Fuzzy search hoạt động như thế nào?

**A:**

- Tính độ tương đồng giữa từ khóa và dữ liệu
- Cho phép sai sót nhỏ (vài ký tự)
- Bỏ qua dấu tiếng Việt
- Threshold: ≥30% tương đồng mới hiện kết quả

---

## 🆘 HỖ TRỢ

### Gặp vấn đề?

1. Kiểm tra console (F12) xem có lỗi không
2. Thử refresh trang (Ctrl+F5)
3. Clear cache và thử lại
4. Liên hệ support

### Báo lỗi:

- 📧 Email: support@pincorp.vn
- 💬 Chat: [Link support]
- 📱 Hotline: 0xxx xxx xxx

---

## 🎓 VIDEO HƯỚNG DẪN

_(Sẽ cập nhật link video hướng dẫn chi tiết)_

- [ ] Video 1: Backup & Restore
- [ ] Video 2: Sử dụng Notifications
- [ ] Video 3: Advanced Search Tips

---

## 🚀 TIẾP THEO

Đang phát triển **Phase 2**:

- 📊 Advanced Analytics Dashboard
- 📝 Audit Log System
- 📱 Barcode/QR Scanner

Stay tuned! 🎉

---

**Chúc bạn sử dụng hiệu quả! 💪**

_Nếu thấy hữu ích, đừng quên đánh giá ⭐⭐⭐⭐⭐_

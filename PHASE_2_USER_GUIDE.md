# 📚 HƯỚNG DẪN SỬ DỤNG TÍNH NĂNG MỚI - PHASE 2

## 🎯 Tổng quan

Phase 2 bổ sung 3 tính năng mạnh mẽ giúp bạn:

- 📊 **Phân tích kinh doanh** sâu sắc hơn
- 📝 **Theo dõi mọi thao tác** trong hệ thống
- 📷 **Quét mã vạch** nhanh chóng và tạo QR code

---

## 1️⃣ PHÂN TÍCH NÂNG CAO 📊

### Truy cập:

1. Click **"Phân tích"** (biểu tượng ✨ tím) trên thanh menu
2. Hoặc vào URL: `/#/analytics`

### Chức năng chính:

#### A. **Key Metrics (Số liệu quan trọng)**

Ngay đầu trang bạn thấy 4 ô số liệu:

```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│ Tổng doanh thu  │ Lợi nhuận gộp   │ Đơn hàng        │ Giá trị TB/đơn  │
│ 50,000,000 đ   │ 15,000,000 đ   │ 245             │ 204,082 đ      │
│ +12.5%         │ 30% biên LN     │ +5.3%          │                 │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

- **Tổng doanh thu**: Tổng tiền bán được
- **Lợi nhuận gộp**: Doanh thu - Chi phí
- **Đơn hàng**: Số đơn hàng đã bán
- **Giá trị TB/đơn**: Trung bình mỗi đơn hàng

#### B. **Dự báo & Xu hướng** 🔮

```
┌────────────────────────────────────────────────────────────────┐
│ 📊 Dự báo & Xu hướng                                           │
├──────────────────┬──────────────────┬──────────────────────────┤
│ Dự báo doanh thu │ Xu hướng hiện tại│ Tăng trưởng YoY          │
│ tháng sau        │                  │                          │
│ 55,000,000 đ    │ 📈 Tăng trưởng   │ +15.2%                  │
└──────────────────┴──────────────────┴──────────────────────────┘
```

- **Dự báo tháng sau**: Hệ thống tự động dự đoán doanh thu
- **Xu hướng**: 📈 Tăng / 📉 Giảm / ➡️ Ổn định
- **YoY**: So sánh với cùng kỳ năm trước

#### C. **Biểu đồ Doanh thu** 📈

Biểu đồ đường với 3 line:

- **Xanh dương**: Doanh thu
- **Xanh lá**: Lợi nhuận
- **Cam**: Chi phí

**Cách dùng:**

- Hover chuột lên chart để xem số liệu chi tiết
- Chọn time range (7 ngày / 30 ngày / 6 tháng)

#### D. **Top 10 Sản phẩm Bán chạy** 🏆

Biểu đồ cột hiển thị 10 sản phẩm có doanh thu cao nhất.

**Thông tin:**

- Tên sản phẩm
- Tổng doanh thu
- Số lượng bán
- Số đơn hàng

#### E. **Phân bố theo Danh mục** 🥧

Biểu đồ tròn hiển thị phân bổ doanh thu theo từng danh mục.

**Ví dụ:**

- Điện tử: 45%
- Linh kiện: 30%
- Phụ kiện: 25%

#### F. **Top 10 Khách hàng Tiềm năng** 👥

Bảng hiển thị khách hàng chi tiêu nhiều nhất.

**Thông tin:**

- Tên & SĐT
- Tổng chi tiêu
- Số đơn hàng
- Trung bình/đơn

### Mẹo sử dụng:

✅ **Chọn time range phù hợp:**

- 7 ngày: Xem xu hướng ngắn hạn
- 30 ngày: Phân tích tháng vừa qua
- 6 tháng: Xu hướng dài hạn

✅ **Theo dõi xu hướng:**

- Nếu 📈 Tăng trưởng → Tiếp tục chiến lược hiện tại
- Nếu 📉 Giảm → Cần điều chỉnh
- Nếu ➡️ Ổn định → Tìm cách đột phá

✅ **Tối ưu sản phẩm:**

- Focus vào top products
- Tăng stock cho sản phẩm bán chạy
- Xem xét giảm giá sản phẩm bán chậm

---

## 2️⃣ AUDIT LOGS 📝

### Truy cập:

1. Click **"Logs"** (biểu tượng 📋 xanh indigo) trên thanh menu
2. Hoặc vào URL: `/#/audit-logs`

### Logs tự động ghi lại gì?

Hệ thống tự động ghi lại **MỌI** thao tác:

- ✅ **Tạo mới**: Thêm sản phẩm, khách hàng, đơn hàng
- ✅ **Xem**: Mở chi tiết sản phẩm
- ✅ **Cập nhật**: Sửa thông tin
- ✅ **Xóa**: Xóa dữ liệu
- ✅ **Xuất/Nhập**: Export/Import dữ liệu

### Thông tin trong mỗi log:

```
┌──────────────────────────────────────────────────────────────┐
│ ⏰ 23/11/2025 14:30:15                                       │
│ 👤 admin@example.com                                         │
│ 🆕 CREATE | 📦 Material | Thép tấm 3mm                       │
│ 📱 Chrome/Windows                                            │
└──────────────────────────────────────────────────────────────┘
```

### Cách sử dụng:

#### A. **Tìm kiếm Logs**

1. **Tìm kiếm văn bản:**

   ```
   🔍 [________________]
   ```

   Gõ từ khóa: tên sản phẩm, tên người dùng, hành động

2. **Filter theo Hành động:**

   ```
   Hành động: [Tất cả ▼]
   ```

   Chọn: Tạo mới / Xem / Cập nhật / Xóa / Xuất / Nhập

3. **Filter theo Module:**
   ```
   Module: [Tất cả ▼]
   ```
   Chọn: Nguyên liệu / Sản phẩm / Bán hàng / Sửa chữa / etc.

#### B. **Xem Chi tiết Log**

Click **"Chi tiết"** trên mỗi log để xem:

```
┌─────────────────────────────────────────────────────────────┐
│ 📝 Chi tiết Log                                             │
├─────────────────────────────────────────────────────────────┤
│ ID: audit-1732369815-abc123                                 │
│ Thời gian: 23/11/2025 14:30:15                              │
│ Người dùng: admin@example.com (user-123)                    │
│ Hành động: ✏️ UPDATE                                        │
│ Module: material - Thép tấm 3mm (MAT001)                    │
│                                                             │
│ 📋 Thay đổi:                                                │
│ {                                                           │
│   "before": { "stock": 100 },                              │
│   "after": { "stock": 95 }                                 │
│ }                                                           │
│                                                             │
│ User Agent: Chrome 120 / Windows 11                         │
└─────────────────────────────────────────────────────────────┘
```

#### C. **Xem Thống kê**

Click **"Xem thống kê"** để xem tổng quan:

```
┌──────────────────────────────────────────────────────────────┐
│ 📊 Thống kê                                                  │
├────────────────┬────────────────┬────────────────────────────┤
│ Tổng số logs   │ Theo hành động │ Theo module                │
│ 1,234          │ create: 450    │ material: 300              │
│                │ update: 500    │ product: 250               │
│                │ delete: 100    │ sale: 400                  │
│                │ read: 184      │ repair: 284                │
└────────────────┴────────────────┴────────────────────────────┘
```

#### D. **Xuất Logs**

Click **"📤 Xuất logs"** để download file JSON.

**Dùng để:**

- Backup audit trail
- Phân tích ngoài hệ thống
- Compliance/Kiểm toán
- Báo cáo bảo mật

#### E. **Xóa Logs Cũ**

Click **"🗑️ Xóa cũ"** để xóa logs > 90 ngày.

**Lưu ý:** Hệ thống tự động giữ tối đa 10,000 logs gần nhất.

### Mẹo sử dụng:

✅ **Tìm lỗi nhanh:**

- Filter theo hành động "delete"
- Tìm xem ai đã xóa gì

✅ **Kiểm tra thay đổi:**

- Xem chi tiết log
- So sánh before/after

✅ **Audit định kỳ:**

- Xuất logs hàng tháng
- Review hoạt động người dùng

✅ **Bảo mật:**

- Theo dõi ai truy cập gì
- Phát hiện hành vi bất thường

---

## 3️⃣ QUÉT MÃ VẠCH 📷

### Truy cập:

1. Click **"Quét mã"** (biểu tượng 📷 xanh sky) trên thanh menu
2. Hoặc vào URL: `/#/barcode`

### Chế độ 1: QUÉT MÃ 📷

#### Chuẩn bị:

1. Cho phép truy cập camera (browser sẽ hỏi)
2. Đảm bảo đủ ánh sáng
3. Giữ mã vạch/QR code rõ ràng

#### Cách quét:

**Bước 1: Chọn Camera** (nếu có nhiều camera)

```
Chọn camera: [Camera sau (environment) ▼]
```

**Bước 2: Bắt đầu quét**

```
┌────────────────────────────┐
│                            │
│     [Khung hình đen]       │
│      📷 Camera              │
│                            │
│  "Nhấn Bắt đầu quét"       │
└────────────────────────────┘

[🎥 Bắt đầu quét]
```

**Bước 3: Đưa mã vào khung**

```
┌────────────────────────────┐
│  ╔═══════════════════╗     │
│  ║                   ║     │
│  ║   QR CODE HERE    ║ ← Đưa mã vào đây
│  ║                   ║     │
│  ╚═══════════════════╝     │
└────────────────────────────┘

[⏹️ Dừng quét]
```

**Bước 4: Xem kết quả**

```
┌────────────────────────────┐
│ ✅ Quét thành công!        │
│                            │
│ MAT001                     │
│                            │
│ Format: QR_CODE            │
│                            │
│ [📋 Sao chép mã]           │
│ [🔄 Quét mã mới]           │
└────────────────────────────┘
```

**Auto Search:**
Hệ thống tự động tìm kiếm sản phẩm sau khi quét:

```
🔍 Tìm thấy nguyên liệu!
   Thép tấm 3mm - MAT001
```

### Chế độ 2: TẠO QR CODE ✨

#### Cách tạo:

**Option 1: Nhập Text**

```
┌─────────────────────────────────────────┐
│ Nội dung QR Code                        │
│ ┌─────────────────────────────────────┐ │
│ │ MAT001                              │ │
│ │                                     │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [✨ Tạo QR Code]                        │
└─────────────────────────────────────────┘
```

**Option 2: Chọn Sản phẩm**

```
Hoặc chọn sản phẩm: [Thép tấm 3mm (MAT001) ▼] [Tạo]
```

**Kết quả:**

```
┌─────────────────────────────────────────┐
│ Xem trước QR Code                       │
│                                         │
│    ┌─────────────────────┐             │
│    │ ████ ████ ████ ████ │             │
│    │ ████ ████ ████ ████ │             │
│    │ ████ ████ ████ ████ │             │
│    │ ████ ████ ████ ████ │             │
│    └─────────────────────┘             │
│                                         │
│ [📥 Tải xuống QR Code]                 │
│ [🔄 Tạo mã mới]                        │
└─────────────────────────────────────────┘
```

### Use Cases thực tế:

#### 🏪 **Quầy bán hàng:**

```
Khách: "Tôi muốn mua thép tấm 3mm"
Bạn:
1. Mở "Quét mã"
2. Quét QR trên kệ hàng
3. → Tự động tìm thấy sản phẩm MAT001
4. Click vào kết quả → Xem tồn kho, giá
5. Thêm vào đơn hàng
```

#### 📦 **Kiểm kê kho:**

```
1. In QR code cho tất cả sản phẩm
2. Dán QR lên kệ/thùng hàng
3. Khi kiểm kê:
   - Quét mã → Biết ngay sản phẩm
   - Đếm số lượng thực tế
   - So sánh với hệ thống
```

#### 🏷️ **Tạo nhãn sản phẩm:**

```
1. Vào "Tạo QR"
2. Chọn sản phẩm từ dropdown
3. Click "Tạo"
4. Download QR code
5. In ra giấy nhãn
6. Dán lên sản phẩm
```

#### 📱 **Tra cứu nhanh:**

```
1. Khách hỏi thông tin sản phẩm
2. Quét QR code trên sản phẩm
3. Xem ngay: giá, tồn kho, mô tả
4. Tư vấn cho khách
```

### Mẹo sử dụng:

✅ **Ánh sáng tốt:**

- Quét ở nơi có đủ ánh sáng
- Tránh ánh sáng chói trực tiếp

✅ **Giữ ổn định:**

- Giữ camera/mã không rung
- Khoảng cách 10-20cm

✅ **QR code rõ nét:**

- In QR ở size lớn (min 3x3cm)
- Giấy trắng, in đen
- Tránh nhăn, rách

✅ **Batch scanning:**

- Quét nhiều mã liên tiếp
- Click "Quét mã mới" sau mỗi lần

---

## ❓ FAQ - Câu hỏi thường gặp

### Analytics:

**Q: Tại sao số liệu không khớp?**
A: Kiểm tra:

- Time range có đúng không?
- Có filter ẩn nào không?
- Dữ liệu đã được sync chưa?

**Q: Dự báo có chính xác không?**
A: Dự báo dựa trên 6 tháng gần nhất. Càng nhiều data, càng chính xác.

**Q: Làm sao xuất chart ra hình?**
A: Hiện tại chưa có. Dùng screenshot (Win + Shift + S).

### Audit Logs:

**Q: Logs có bị mất không?**
A: Không, logs lưu trong localStorage. Chỉ xóa khi bạn click "Xóa cũ" hoặc clear browser data.

**Q: Ai có thể xem logs?**
A: Tất cả users đăng nhập. (Future: phân quyền theo role)

**Q: Tối đa bao nhiêu logs?**
A: 10,000 logs. Logs cũ nhất tự động xóa khi vượt quá.

### Barcode:

**Q: Camera không hoạt động?**
A: Kiểm tra:

- Browser đã cho phép camera?
- Có camera nào available không?
- Thử browser khác (Chrome/Edge khuyến nghị)

**Q: Không quét được mã?**
A: Kiểm tra:

- Ánh sáng có đủ không?
- QR code có rõ nét không?
- Khoảng cách có phù hợp không?

**Q: QR code tải về ở đâu?**
A: Thư mục Downloads mặc định của browser.

---

## 🎓 Kịch bản sử dụng hàng ngày

### 📅 **Buổi sáng (9:00 AM):**

1. **Check Analytics:**

   - Xem doanh thu hôm qua
   - Check xu hướng tuần này
   - Note sản phẩm bán chạy

2. **Review Logs:**
   - Xem logs overnight
   - Check có hoạt động bất thường không
   - Verify các thao tác quan trọng

### 💼 **Trong ngày:**

3. **Bán hàng với Barcode:**

   - Khách vào → Quét mã sản phẩm
   - Kiểm tra tồn kho nhanh
   - Thêm vào đơn hàng

4. **Kiểm tra hiệu quả:**
   - Xem analytics real-time
   - Theo dõi số đơn hàng
   - Adjust chiến lược nếu cần

### 🌙 **Cuối ngày (6:00 PM):**

5. **Tổng kết:**

   - Review analytics ngày hôm nay
   - Xuất logs nếu cần
   - Plan cho ngày mai

6. **Chuẩn bị:**
   - In QR code cho hàng mới
   - Update inventory labels
   - Backup logs quan trọng

---

## 💡 Tips & Tricks

### ⚡ **Productivity Hacks:**

1. **Keyboard Shortcuts:**

   - Ctrl + F: Tìm kiếm trong logs
   - F5: Refresh analytics

2. **Browser Bookmarks:**

   - Bookmark: `/#/analytics`
   - Bookmark: `/#/audit-logs`
   - Bookmark: `/#/barcode`

3. **Multi-screen Setup:**
   - Screen 1: Bán hàng
   - Screen 2: Analytics real-time
   - Screen 3: Barcode scanner

### 📊 **Data-Driven Decisions:**

1. **Weekly Review:**

   - Compare 7 days vs previous 7 days
   - Identify trends
   - Adjust inventory

2. **Monthly Planning:**

   - Review 30-day analytics
   - Check predictive forecast
   - Plan purchases

3. **Quarterly Strategy:**
   - 6-month trend analysis
   - YoY comparison
   - Set new targets

---

## 🎉 Chúc bạn sử dụng hiệu quả!

Nếu có câu hỏi, liên hệ support hoặc xem documentation đầy đủ tại `PHASE_2_COMPLETE.md`.

**Happy analyzing! 📊📝📷**

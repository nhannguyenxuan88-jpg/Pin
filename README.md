# PinCorp App - Ứng Dụng Quản Lý Sản Xuất Độc Lập

Ứng dụng quản lý sản xuất độc lập dành cho PinCorp, được tách riêng từ hệ thống MotoCarePro-Pin.

## 📋 Mô Tả

PinCorp App là một ứng dụng quản lý sản xuất toàn diện bao gồm:

- **Quản lý Nguyên Liệu**: Theo dõi kho nguyên liệu, nhập xuất tồn
- **Quản lý BOM**: Định mức nguyên liệu cho từng sản phẩm
- **Quản lý Sản Xuất**: Lập lệnh sản xuất, theo dõi tiến độ, tính giá thành
- **Quản lý Bán Hàng**: Bán thành phẩm và nguyên liệu
- **Quản lý Sửa Chữa**: Tiếp nhận và xử lý đơn sửa chữa
- **Báo Cáo Tài Chính**: Báo cáo doanh thu, chi phí, lợi nhuận

## 🚀 Cài Đặt

### Yêu Cầu Hệ Thống

- Node.js 18.x hoặc cao hơn
- npm hoặc yarn
- Tài khoản Supabase (để kết nối database)

### Các Bước Cài Đặt

1. **Clone repository hoặc sao chép thư mục PinCorp-App**

2. **Cài đặt dependencies**
   ```bash
   npm install
   ```

3. **Cấu hình môi trường**
   
   Sao chép file `.env.example` thành `.env.local`:
   ```bash
   copy .env.example .env.local
   ```

4. **Cập nhật thông tin Supabase trong `.env.local`**
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

   Lấy thông tin Supabase từ: https://app.supabase.com/project/your-project-id/settings/api

5. **Chạy ứng dụng trong chế độ development**
   ```bash
   npm run dev
   ```

   Ứng dụng sẽ chạy tại: http://localhost:3002

6. **Build cho production**
   ```bash
   npm run build
   ```

   Xem preview production build:
   ```bash
   npm run preview
   ```

## 🗂️ Cấu Trúc Thư Mục

```
PinCorp-App/
├── components/              # React components
│   ├── common/             # Components dùng chung
│   ├── *.tsx               # Components chính (PinCorpApp, MaterialManager, etc.)
│   └── Login.tsx           # Component đăng nhập
├── contexts/               # React contexts
│   ├── PinContext.tsx     # Context chính
│   ├── PinProviderStandalone.tsx
│   └── types.ts
├── lib/                    # Services và utilities
│   └── services/          # Business logic services
├── src/                    # Assets
│   └── index.css          # Global styles
├── public/                 # Static files
├── App.tsx                 # Root component
├── main.tsx               # Entry point
├── index.html             # HTML template
├── supabaseClient.ts      # Supabase configuration
├── types.ts               # TypeScript types
├── vite.config.ts         # Vite configuration
├── tailwind.config.cjs    # Tailwind CSS configuration
├── tsconfig.json          # TypeScript configuration
└── package.json           # Dependencies và scripts
```

## 🔐 Xác Thực

Ứng dụng sử dụng Supabase Authentication. Người dùng cần đăng nhập bằng email và mật khẩu.

### Development Mode

Trong môi trường development, bạn có thể bỏ qua đăng nhập bằng cách:

1. Thêm vào `.env.local`:
   ```env
   VITE_DEV_AUTH_BYPASS=1
   ```

2. Hoặc tại màn hình login, nhấn nút "Bỏ qua đăng nhập (DEV)"

**Lưu ý**: Tính năng này chỉ hoạt động trên localhost.

## 📊 Database Schema

Ứng dụng sử dụng các bảng chính sau trong Supabase:

- `pin_materials`: Nguyên liệu
- `pin_material_history`: Lịch sử nhập nguyên liệu
- `pin_boms`: Định mức BOM
- `pin_production_orders`: Lệnh sản xuất
- `pin_products`: Thành phẩm
- `pin_sales`: Đơn bán hàng
- `pin_customers`: Khách hàng
- `pin_repair_orders`: Đơn sửa chữa
- `profiles`: Thông tin người dùng

## 🎨 Giao Diện

Ứng dụng sử dụng:
- **React** 19.x
- **Tailwind CSS** cho styling
- **Lucide React** cho icons
- **React Router** cho navigation
- **TanStack Query** cho data fetching

## 🔧 Scripts Có Sẵn

- `npm run dev` - Chạy development server (port 3002)
- `npm run build` - Build production
- `npm run preview` - Preview production build

## 📝 Lưu Ý Quan Trọng

### Bảo Mật

1. **KHÔNG BAO GIỜ** commit file `.env.local` vào Git
2. File `.env.local` đã được thêm vào `.gitignore`
3. Trong production, sử dụng environment variables của hosting platform (Vercel, Netlify, etc.)
4. Chỉ sử dụng `SUPABASE_ANON_KEY`, không dùng `service_role` key trong client

### Database

- Ứng dụng yêu cầu Row Level Security (RLS) được bật trên tất cả các bảng
- Người dùng chỉ có thể truy cập dữ liệu của mình
- Admin cần được cấu hình role phù hợp trong database

### Port

- Ứng dụng mặc định chạy trên port **3002**
- Thay đổi port trong `vite.config.ts` nếu cần

## 🐛 Troubleshooting

### Lỗi "Running in offline mode"

**Nguyên nhân**: Chưa cấu hình Supabase credentials

**Giải pháp**:
1. Kiểm tra file `.env.local` đã tồn tại
2. Đảm bảo có giá trị đúng cho `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`
3. Restart dev server

### Lỗi "PRODUCTION BUILD ERROR"

**Nguyên nhân**: Đang build production mà chưa có credentials

**Giải pháp**: Set environment variables trong build environment

### Module not found

**Giải pháp**: Chạy lại `npm install`

## 📞 Hỗ Trợ

Nếu gặp vấn đề, vui lòng:
1. Kiểm tra logs trong browser console
2. Kiểm tra network tab để xem API calls
3. Đảm bảo Supabase database đã được setup đúng

## 📄 License

Ứng dụng này là proprietary software cho PinCorp.

---

**Phiên bản**: 1.0.0  
**Ngày tạo**: November 5, 2025  
**Tách từ**: MotoCarePro-Pin

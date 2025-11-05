# =====================================================
# PinCorp App - Setup Script
# =====================================================
# Script tự động setup ứng dụng PinCorp độc lập
# =====================================================

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "  PINCORP APP - SETUP SCRIPT" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# Kiểm tra Node.js
Write-Host "[1/4] Kiểm tra Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js đã cài đặt: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js chưa được cài đặt!" -ForegroundColor Red
    Write-Host "Vui lòng cài đặt Node.js từ: https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Cài đặt dependencies
Write-Host ""
Write-Host "[2/4] Cài đặt dependencies..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Lỗi khi cài đặt dependencies!" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Dependencies đã được cài đặt" -ForegroundColor Green

# Kiểm tra file .env.local
Write-Host ""
Write-Host "[3/4] Kiểm tra cấu hình môi trường..." -ForegroundColor Yellow

if (Test-Path ".env.local") {
    Write-Host "✓ File .env.local đã tồn tại" -ForegroundColor Green
} else {
    Write-Host "! File .env.local chưa tồn tại" -ForegroundColor Yellow
    
    # Hỏi người dùng có muốn tạo từ template không
    $createEnv = Read-Host "Bạn có muốn tạo file .env.local từ template? (Y/N)"
    
    if ($createEnv -eq "Y" -or $createEnv -eq "y") {
        Copy-Item ".env.example" ".env.local"
        Write-Host "✓ Đã tạo file .env.local từ .env.example" -ForegroundColor Green
        Write-Host ""
        Write-Host "⚠ QUAN TRỌNG: Vui lòng cập nhật thông tin Supabase trong file .env.local" -ForegroundColor Yellow
        Write-Host "   - VITE_SUPABASE_URL=https://your-project-id.supabase.co" -ForegroundColor Gray
        Write-Host "   - VITE_SUPABASE_ANON_KEY=your-anon-key-here" -ForegroundColor Gray
    } else {
        Write-Host "! Bỏ qua tạo file .env.local" -ForegroundColor Yellow
        Write-Host "  Ứng dụng sẽ chạy ở chế độ offline" -ForegroundColor Gray
    }
}

# Hoàn tất
Write-Host ""
Write-Host "[4/4] Setup hoàn tất!" -ForegroundColor Yellow
Write-Host ""
Write-Host "===================================" -ForegroundColor Green
Write-Host "  ✓ SETUP THÀNH CÔNG!" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Green
Write-Host ""
Write-Host "Các bước tiếp theo:" -ForegroundColor Cyan
Write-Host "1. Cập nhật thông tin Supabase trong .env.local (nếu chưa)" -ForegroundColor White
Write-Host "2. Chạy: npm run dev" -ForegroundColor White
Write-Host "3. Mở trình duyệt tại: http://localhost:3002" -ForegroundColor White
Write-Host ""
Write-Host "Lệnh hữu ích:" -ForegroundColor Cyan
Write-Host "  npm run dev     - Chạy development server" -ForegroundColor Gray
Write-Host "  npm run build   - Build production" -ForegroundColor Gray
Write-Host "  npm run preview - Preview production build" -ForegroundColor Gray
Write-Host ""
Write-Host "Để biết thêm chi tiết, xem file README.md" -ForegroundColor Gray
Write-Host ""

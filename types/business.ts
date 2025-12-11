// Business/Company Settings Types
export interface BusinessSettings {
  id: string;
  // Thông tin công ty/cửa hàng
  businessName: string;
  businessNameEnglish?: string;
  businessType: "company" | "individual" | "household"; // Công ty, Cá nhân, Hộ kinh doanh

  // Địa chỉ
  address: string;
  ward?: string; // Phường/Xã
  district?: string; // Quận/Huyện
  city?: string; // Tỉnh/Thành phố

  // Liên hệ
  phone: string;
  email?: string;
  website?: string;

  // Thông tin pháp lý
  taxCode?: string; // Mã số thuế
  businessLicense?: string; // Số ĐKKD/Giấy phép KD
  businessLicenseDate?: string; // Ngày cấp
  businessLicensePlace?: string; // Nơi cấp

  // Thông tin ngân hàng
  bankName?: string;
  bankAccount?: string;
  bankAccountName?: string; // Chủ tài khoản
  bankBranch?: string;
  bankQRUrl?: string; // Mã QR thanh toán (ảnh upload)

  // Logo và branding
  logoUrl?: string;
  slogan?: string;

  // Cài đặt hóa đơn
  invoicePrefix?: string; // Tiền tố hóa đơn (VD: HD, INV)
  invoiceSerialFormat?: string; // Format số hóa đơn
  invoiceFooterNote?: string; // Ghi chú cuối hóa đơn

  // Người đại diện
  representativeName?: string;
  representativePosition?: string;

  // Metadata
  created_at?: string;
  updated_at?: string;
}

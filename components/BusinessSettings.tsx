import React, { useState, useEffect } from "react";
import { usePinContext } from "../contexts/PinContext";
import type { BusinessSettings } from "../types/business";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Icon } from "./common/Icon";

export default function BusinessSettingsPage() {
  const { currentUser, addToast } = usePinContext();
  const [settings, setSettings] = useState<BusinessSettings>({
    id: "default",
    businessName: "",
    businessType: "household",
    address: "",
    phone: "",
    email: "",
    taxCode: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const saved = localStorage.getItem("businessSettings");
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings(parsed);
        if (parsed.logoUrl) {
          setLogoPreview(parsed.logoUrl);
        }
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const handleChange = (field: keyof BusinessSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setLogoPreview(result);
        setSettings((prev) => ({ ...prev, logoUrl: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!currentUser) {
      addToast?.({
        title: "Lỗi",
        message: "Vui lòng đăng nhập để lưu cài đặt",
        type: "error",
      });
      return;
    }

    if (!settings.businessName.trim()) {
      addToast?.({
        title: "Lỗi",
        message: "Vui lòng nhập tên doanh nghiệp/cửa hàng",
        type: "error",
      });
      return;
    }

    setIsSaving(true);
    try {
      const updatedSettings = {
        ...settings,
        updated_at: new Date().toISOString(),
      };

      // Save to localStorage (hoặc có thể lưu vào Supabase)
      localStorage.setItem("businessSettings", JSON.stringify(updatedSettings));

      addToast?.({
        title: "Thành công",
        message: "Đã lưu cài đặt thông tin doanh nghiệp",
        type: "success",
      });
    } catch (error: any) {
      console.error("Error saving settings:", error);
      addToast?.({
        title: "Lỗi",
        message: error.message || "Không thể lưu cài đặt",
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Thông tin Doanh nghiệp
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Cấu hình thông tin hiển thị trên hóa đơn và báo cáo
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} variant="primary">
          {isSaving ? "Đang lưu..." : "Lưu cài đặt"}
        </Button>
      </div>

      {/* Logo Upload */}
      <Card>
        <h2 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-100">
          Logo & Branding
        </h2>
        <div className="space-y-4">
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Logo"
                  className="w-32 h-32 object-contain border-2 border-slate-200 dark:border-slate-700 rounded-lg p-2"
                />
              ) : (
                <div className="w-32 h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg flex items-center justify-center">
                  <div className="w-8 h-8 text-slate-400">📷</div>
                </div>
              )}
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Tải lên Logo
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/20 dark:file:text-blue-400"
              />
              <p className="text-xs text-slate-500 mt-1">
                Định dạng: PNG, JPG. Kích thước tối đa: 2MB
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Slogan
            </label>
            <input
              type="text"
              value={settings.slogan || ""}
              onChange={(e) => handleChange("slogan", e.target.value)}
              placeholder="VD: Uy tín - Chất lượng - Giá tốt"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            />
          </div>
        </div>
      </Card>

      {/* Thông tin cơ bản */}
      <Card>
        <h2 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-100">
          Thông tin cơ bản
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Tên doanh nghiệp/Cửa hàng <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={settings.businessName}
              onChange={(e) => handleChange("businessName", e.target.value)}
              placeholder="VD: Công ty TNHH SmartCare"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Tên tiếng Anh
            </label>
            <input
              type="text"
              value={settings.businessNameEnglish || ""}
              onChange={(e) => handleChange("businessNameEnglish", e.target.value)}
              placeholder="VD: SmartCare Co., Ltd"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Loại hình
            </label>
            <select
              value={settings.businessType}
              onChange={(e) => handleChange("businessType", e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            >
              <option value="household">Hộ kinh doanh</option>
              <option value="individual">Cá nhân</option>
              <option value="company">Công ty</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Địa chỉ */}
      <Card>
        <h2 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-100">Địa chỉ</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Địa chỉ cửa hàng <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={settings.address}
              onChange={(e) => handleChange("address", e.target.value)}
              placeholder="VD: 123 Nguyễn Văn Linh, TP. Cao Lãnh, Đồng Tháp"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              Nhập đầy đủ địa chỉ bao gồm số nhà, đường, thành phố/huyện, tỉnh
            </p>
          </div>
        </div>
      </Card>

      {/* Liên hệ */}
      <Card>
        <h2 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-100">
          Thông tin liên hệ
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Số điện thoại <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={settings.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              placeholder="VD: 0947-747-307"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={settings.email || ""}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="VD: info@company.com"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Website
            </label>
            <input
              type="url"
              value={settings.website || ""}
              onChange={(e) => handleChange("website", e.target.value)}
              placeholder="VD: https://yourwebsite.com"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            />
          </div>
        </div>
      </Card>

      {/* Thông tin pháp lý */}
      <Card>
        <h2 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-100">
          Thông tin pháp lý & Thuế
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Mã số thuế
            </label>
            <input
              type="text"
              value={settings.taxCode || ""}
              onChange={(e) => handleChange("taxCode", e.target.value)}
              placeholder="VD: 0123456789"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Số ĐKKD/Giấy phép KD
            </label>
            <input
              type="text"
              value={settings.businessLicense || ""}
              onChange={(e) => handleChange("businessLicense", e.target.value)}
              placeholder="VD: 0312345678"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Ngày cấp
            </label>
            <input
              type="date"
              value={settings.businessLicenseDate || ""}
              onChange={(e) => handleChange("businessLicenseDate", e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Nơi cấp
            </label>
            <input
              type="text"
              value={settings.businessLicensePlace || ""}
              onChange={(e) => handleChange("businessLicensePlace", e.target.value)}
              placeholder="VD: Sở Kế hoạch và Đầu tư TP.HCM"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            />
          </div>
        </div>
      </Card>

      {/* Thông tin ngân hàng */}
      <Card>
        <h2 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-100">
          Thông tin ngân hàng
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Tên ngân hàng
            </label>
            <input
              type="text"
              value={settings.bankName || ""}
              onChange={(e) => handleChange("bankName", e.target.value)}
              placeholder="VD: LPBank"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Số tài khoản
            </label>
            <input
              type="text"
              value={settings.bankAccount || ""}
              onChange={(e) => handleChange("bankAccount", e.target.value)}
              placeholder="VD: 0944619393"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Chủ tài khoản <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={settings.bankAccountName || ""}
              onChange={(e) => handleChange("bankAccountName", e.target.value)}
              placeholder="VD: NGUYEN VAN A"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Chi nhánh
            </label>
            <input
              type="text"
              value={settings.bankBranch || ""}
              onChange={(e) => handleChange("bankBranch", e.target.value)}
              placeholder="VD: Đồng Tháp"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            />
          </div>

          {/* Bank QR Code Upload */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Mã QR thanh toán
            </label>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                {settings.bankQRUrl ? (
                  <img
                    src={settings.bankQRUrl}
                    alt="Bank QR"
                    className="w-32 h-32 object-contain border-2 border-slate-200 dark:border-slate-700 rounded-lg p-1"
                  />
                ) : (
                  <div className="w-32 h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg flex items-center justify-center">
                    <span className="text-3xl">📱</span>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        handleChange("bankQRUrl", reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 dark:file:bg-green-900/20 dark:file:text-green-400"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Tải lên mã QR từ ngân hàng (VietQR, QR thanh toán từ app ngân hàng)
                </p>
                {settings.bankQRUrl && (
                  <button
                    type="button"
                    onClick={() => handleChange("bankQRUrl", "")}
                    className="text-xs text-red-600 hover:text-red-800 mt-2"
                  >
                    Xóa mã QR
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Cài đặt hóa đơn */}
      <Card>
        <h2 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-100">
          Cài đặt Hóa đơn
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Tiền tố hóa đơn
            </label>
            <input
              type="text"
              value={settings.invoicePrefix || ""}
              onChange={(e) => handleChange("invoicePrefix", e.target.value)}
              placeholder="VD: HD, INV"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Người đại diện
            </label>
            <input
              type="text"
              value={settings.representativeName || ""}
              onChange={(e) => handleChange("representativeName", e.target.value)}
              placeholder="VD: Trương Văn Cường"
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Ghi chú cuối hóa đơn
            </label>
            <textarea
              value={settings.invoiceFooterNote || ""}
              onChange={(e) => handleChange("invoiceFooterNote", e.target.value)}
              placeholder="VD: Cảm ơn quý khách đã sử dụng dịch vụ! Vui lòng gửi phiếu dịch vụ để được bảo hành khi cần!"
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
            />
          </div>
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} variant="secondary">
          {isSaving ? "Đang kiểm tra..." : "Kiểm tra kết nối"}
        </Button>
      </div>
    </div>
  );
}

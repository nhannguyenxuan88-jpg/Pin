// Business Settings Service - Quản lý thông tin doanh nghiệp với Supabase
import { supabase, isSupabaseConfigured } from "../../supabaseClient";
import type { BusinessSettings } from "../../types/business";

const STORAGE_KEY = "pin_business_settings";
const DEFAULT_ID = "default";

export class BusinessSettingsService {
  /**
   * Lấy thông tin doanh nghiệp
   */
  static async getSettings(): Promise<BusinessSettings | null> {
    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase
          .from("pin_business_settings")
          .select("*")
          .eq("id", DEFAULT_ID)
          .single();

        if (error && error.code !== "PGRST116") {
          console.error("Error fetching business settings:", error);
          throw error;
        }

        if (data) {
          const settings: BusinessSettings = {
            id: data.id || "default",
            businessName: data.business_name || "",
            businessNameEnglish: data.business_name_english || "",
            businessType: data.business_type || "household",
            address: data.address || data.business_address || "",
            ward: data.ward || "",
            district: data.district || "",
            city: data.city || "",
            phone: data.phone || data.business_phone || "",
            email: data.email || data.business_email || "",
            website: data.website || "",
            taxCode: data.tax_code || "",
            businessLicense: data.business_license || "",
            businessLicenseDate: data.business_license_date || "",
            businessLicensePlace: data.business_license_place || "",
            bankName: data.bank_name || "",
            bankAccount: data.bank_account || "",
            bankAccountName: data.bank_account_name || "",
            bankBranch: data.bank_branch || "",
            bankQRUrl: data.bank_qr_url || "",
            logoUrl: data.logo_url || "",
            slogan: data.slogan || "",
            invoicePrefix: data.invoice_prefix || "",
            invoiceSerialFormat: data.invoice_serial_format || "",
            invoiceFooterNote: data.invoice_footer_note || data.invoice_footer || "",
            representativeName: data.representative_name || "",
            representativePosition: data.representative_position || "",
            created_at: data.created_at,
            updated_at: data.updated_at,
          };

          // Also save to localStorage as cache
          localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
          return settings;
        }
      }

      // Fallback to localStorage
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as BusinessSettings;
      }

      return null;
    } catch (error) {
      console.error("Error loading business settings:", error);

      // Fallback to localStorage on error
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as BusinessSettings;
      }

      return null;
    }
  }

  /**
   * Lưu thông tin doanh nghiệp
   */
  static async saveSettings(settings: BusinessSettings): Promise<boolean> {
    try {
      // Always save to localStorage as cache
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

      if (isSupabaseConfigured()) {
        const { error } = await supabase.from("pin_business_settings").upsert(
          {
            id: DEFAULT_ID,
            business_name: settings.businessName || null,
            business_name_english: settings.businessNameEnglish || null,
            business_type: settings.businessType || "household",
            address: settings.address || null,
            ward: settings.ward || null,
            district: settings.district || null,
            city: settings.city || null,
            phone: settings.phone || null,
            email: settings.email || null,
            website: settings.website || null,
            tax_code: settings.taxCode || null,
            business_license: settings.businessLicense || null,
            business_license_date: settings.businessLicenseDate || null,
            business_license_place: settings.businessLicensePlace || null,
            bank_name: settings.bankName || null,
            bank_account: settings.bankAccount || null,
            bank_account_name: settings.bankAccountName || null,
            bank_branch: settings.bankBranch || null,
            bank_qr_url: settings.bankQRUrl || null,
            logo_url: settings.logoUrl || null,
            slogan: settings.slogan || null,
            invoice_prefix: settings.invoicePrefix || null,
            invoice_serial_format: settings.invoiceSerialFormat || null,
            invoice_footer_note: settings.invoiceFooterNote || null,
            representative_name: settings.representativeName || null,
            representative_position: settings.representativePosition || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

        if (error) {
          console.error("Error saving business settings to Supabase:", error);
          // Still return true since we saved to localStorage
          return true;
        }
      }

      return true;
    } catch (error) {
      console.error("Error saving business settings:", error);
      return false;
    }
  }

  /**
   * Upload logo hoặc QR image
   */
  static async uploadImage(file: File, type: "logo" | "qr"): Promise<string | null> {
    try {
      if (!isSupabaseConfigured()) {
        // Fallback to base64 for localStorage
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${type}_${Date.now()}.${fileExt}`;
      const filePath = `business/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("public")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error("Error uploading image:", uploadError);
        // Fallback to base64
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }

      const { data: urlData } = supabase.storage.from("public").getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      return null;
    }
  }
}

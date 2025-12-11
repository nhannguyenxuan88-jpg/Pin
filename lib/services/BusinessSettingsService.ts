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
            businessName: data.business_name || "",
            businessAddress: data.business_address || "",
            businessPhone: data.business_phone || "",
            businessEmail: data.business_email || "",
            taxCode: data.tax_code || "",
            bankAccount: data.bank_account || "",
            bankName: data.bank_name || "",
            bankAccountName: data.bank_account_name || "",
            bankQrUrl: data.bank_qr_url || "",
            logoUrl: data.logo_url || "",
            invoiceFooter: data.invoice_footer || "",
            invoiceNotes: data.invoice_notes || "",
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
            business_address: settings.businessAddress || null,
            business_phone: settings.businessPhone || null,
            business_email: settings.businessEmail || null,
            tax_code: settings.taxCode || null,
            bank_account: settings.bankAccount || null,
            bank_name: settings.bankName || null,
            bank_account_name: settings.bankAccountName || null,
            bank_qr_url: settings.bankQrUrl || null,
            logo_url: settings.logoUrl || null,
            invoice_footer: settings.invoiceFooter || null,
            invoice_notes: settings.invoiceNotes || null,
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

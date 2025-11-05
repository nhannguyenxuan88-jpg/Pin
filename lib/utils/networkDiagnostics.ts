/**
 * Network Diagnostics Utility
 * Helper functions to diagnose and troubleshoot connection issues
 */

import { supabase } from "../../supabaseClient";

export interface DiagnosticResult {
  check: string;
  status: "success" | "warning" | "error";
  message: string;
  details?: string;
}

/**
 * Run basic connectivity checks
 */
export async function runNetworkDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];

  // Check 1: Browser online status
  results.push({
    check: "Browser Online Status",
    status: navigator.onLine ? "success" : "error",
    message: navigator.onLine ? "Browser is online" : "Browser is offline",
    details: navigator.onLine
      ? "Network connection detected"
      : "No network connection detected",
  });

  // Check 2: Supabase URL configuration
  const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
  results.push({
    check: "Supabase URL",
    status:
      supabaseUrl && !supabaseUrl.includes("placeholder") ? "success" : "error",
    message: supabaseUrl ? "Supabase URL configured" : "Supabase URL not set",
    details: supabaseUrl || "VITE_SUPABASE_URL environment variable is missing",
  });

  // Check 3: Supabase connection
  try {
    const startTime = Date.now();
    const { error } = await supabase
      .from("profiles")
      .select("count")
      .limit(1)
      .single();
    const duration = Date.now() - startTime;

    if (error && !error.message.includes("multiple")) {
      results.push({
        check: "Supabase Connection",
        status: "error",
        message: "Failed to connect to Supabase",
        details: error.message,
      });
    } else {
      results.push({
        check: "Supabase Connection",
        status: duration > 3000 ? "warning" : "success",
        message: `Connected to Supabase (${duration}ms)`,
        details:
          duration > 3000 ? "Connection is slow" : "Connection is healthy",
      });
    }
  } catch (e: any) {
    results.push({
      check: "Supabase Connection",
      status: "error",
      message: "Connection failed",
      details: e.message || "Unknown error",
    });
  }

  // Check 4: DNS resolution (basic)
  if (navigator.onLine) {
    try {
      const response = await fetch("https://www.google.com/favicon.ico", {
        mode: "no-cors",
        cache: "no-cache",
      });
      results.push({
        check: "Internet Connectivity",
        status: "success",
        message: "Internet connection verified",
        details: "Successfully reached external server",
      });
    } catch (e: any) {
      results.push({
        check: "Internet Connectivity",
        status: "error",
        message: "Cannot reach external servers",
        details: "May be behind firewall or proxy",
      });
    }
  }

  return results;
}

/**
 * Get common network error suggestions
 */
export function getNetworkErrorSuggestions(error: any): string[] {
  const suggestions: string[] = [];
  const errorMsg = error?.message || error?.toString() || "";

  if (
    errorMsg.includes("Failed to fetch") ||
    errorMsg.includes("NetworkError")
  ) {
    suggestions.push("Kiểm tra kết nối internet của bạn");
    suggestions.push("Tắt VPN hoặc proxy nếu đang sử dụng");
    suggestions.push("Kiểm tra firewall hoặc antivirus");
    suggestions.push("Thử refresh trang (Ctrl+F5 hoặc Cmd+Shift+R)");
  }

  if (errorMsg.includes("TIMED_OUT") || errorMsg.includes("timeout")) {
    suggestions.push("Kết nối quá chậm hoặc không ổn định");
    suggestions.push("Thử kết nối mạng khác (4G/5G thay vì WiFi)");
    suggestions.push("Khởi động lại router");
  }

  if (errorMsg.includes("CORS") || errorMsg.includes("Access-Control")) {
    suggestions.push("Lỗi CORS - liên hệ admin để kiểm tra cấu hình server");
    suggestions.push("Đảm bảo đang truy cập từ domain được phép");
  }

  if (errorMsg.includes("ERR_CERT") || errorMsg.includes("certificate")) {
    suggestions.push("Lỗi SSL certificate");
    suggestions.push("Kiểm tra ngày giờ hệ thống");
    suggestions.push("Cập nhật browser lên phiên bản mới nhất");
  }

  if (suggestions.length === 0) {
    suggestions.push("Kiểm tra kết nối internet");
    suggestions.push("Thử lại sau vài phút");
    suggestions.push("Liên hệ support nếu vấn đề vẫn tiếp diễn");
  }

  return suggestions;
}

/**
 * Format diagnostic results for display
 */
export function formatDiagnosticResults(results: DiagnosticResult[]): string {
  let output = "=== NETWORK DIAGNOSTICS ===\n\n";

  results.forEach((result, index) => {
    const icon =
      result.status === "success"
        ? "✅"
        : result.status === "warning"
        ? "⚠️"
        : "❌";
    output += `${index + 1}. ${icon} ${result.check}\n`;
    output += `   ${result.message}\n`;
    if (result.details) {
      output += `   Details: ${result.details}\n`;
    }
    output += "\n";
  });

  return output;
}

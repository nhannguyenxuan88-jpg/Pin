import React from "react";
import { InformationCircleIcon } from "./Icons";

interface TroubleshootingTipsProps {
  error?: string;
}

export function TroubleshootingTips({ error }: TroubleshootingTipsProps) {
  const errorMsg = error?.toLowerCase() || "";

  // Determine which tips to show based on error
  const showNetworkTips =
    errorMsg.includes("timeout") ||
    errorMsg.includes("connection") ||
    errorMsg.includes("network") ||
    errorMsg.includes("fetch");

  const showFirewallTips =
    errorMsg.includes("cors") ||
    errorMsg.includes("blocked") ||
    errorMsg.includes("refused");

  const showDNSTips =
    errorMsg.includes("dns") ||
    errorMsg.includes("not found") ||
    errorMsg.includes("resolve");

  if (!showNetworkTips && !showFirewallTips && !showDNSTips) {
    return null;
  }

  return (
    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
      <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
        <InformationCircleIcon className="w-4 h-4" />
        Gợi ý khắc phục
      </h3>

      <div className="space-y-2 text-xs text-blue-700 dark:text-blue-300">
        {showNetworkTips && (
          <>
            <div className="flex items-start gap-2">
              <span className="text-blue-500 dark:text-blue-400 mt-0.5">•</span>
              <span>Kiểm tra kết nối internet (WiFi/4G/5G)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-500 dark:text-blue-400 mt-0.5">•</span>
              <span>Thử đổi sang mạng khác (WiFi → 4G hoặc ngược lại)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-500 dark:text-blue-400 mt-0.5">•</span>
              <span>Khởi động lại router/modem</span>
            </div>
          </>
        )}

        {showFirewallTips && (
          <>
            <div className="flex items-start gap-2">
              <span className="text-blue-500 dark:text-blue-400 mt-0.5">•</span>
              <span>Tắt VPN nếu đang bật</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-500 dark:text-blue-400 mt-0.5">•</span>
              <span>Tắt tạm thời Firewall/Antivirus để test</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-500 dark:text-blue-400 mt-0.5">•</span>
              <span>Thử browser khác (Chrome/Firefox/Edge)</span>
            </div>
          </>
        )}

        {showDNSTips && (
          <>
            <div className="flex items-start gap-2">
              <span className="text-blue-500 dark:text-blue-400 mt-0.5">•</span>
              <span>
                Đổi DNS sang Google (8.8.8.8) hoặc Cloudflare (1.1.1.1)
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-500 dark:text-blue-400 mt-0.5">•</span>
              <span>Xóa DNS cache: chạy "ipconfig /flushdns" (Windows)</span>
            </div>
          </>
        )}

        <div className="flex items-start gap-2 pt-2 border-t border-blue-200 dark:border-blue-800">
          <span className="text-blue-500 dark:text-blue-400 mt-0.5">💡</span>
          <span className="font-medium">
            Refresh trang (Ctrl+F5) sau khi thử các bước trên
          </span>
        </div>
      </div>
    </div>
  );
}

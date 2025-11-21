import React from "react";
import { usePermission } from "@/lib/hooks/usePermission";
import { LockClosedIcon } from "./Icons";

interface ProtectedComponentProps {
  module: string;
  action: string;
  app?: "motocare" | "pincorp";
  fallback?: React.ReactNode;
  children: React.ReactNode;
  silentFail?: boolean; // Nếu true, không render gì nếu không có permission
}

/**
 * Component wrapper để bảo vệ access dựa trên permission
 */
export default function ProtectedComponent({
  module,
  action,
  app = "motocare",
  fallback,
  children,
  silentFail = false,
}: ProtectedComponentProps) {
  const { hasPermission, isLoading, error } = usePermission(module, action, {
    app,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin">⏳ Đang kiểm tra quyền truy cập...</div>
      </div>
    );
  }

  if (error) {
    console.error(`Permission check error for ${module}.${action}:`, error);
  }

  if (!hasPermission) {
    if (silentFail) return null;

    return (
      fallback || (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-6 text-center">
          <LockClosedIcon className="w-12 h-12 mx-auto mb-3 text-red-600 dark:text-red-400" />
          <h3 className="text-lg font-bold text-red-900 dark:text-red-100 mb-2">
            Truy cập Bị Từ Chối
          </h3>
          <p className="text-red-800 dark:text-red-200 mb-4">
            Bạn không có quyền truy cập tính năng này ({module}.{action})
          </p>
          <p className="text-sm text-red-600 dark:text-red-400">
            Vui lòng liên hệ quản trị viên để được cấp quyền truy cập
          </p>
        </div>
      )
    );
  }

  return <>{children}</>;
}

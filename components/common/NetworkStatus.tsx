import { useEffect, useState } from "react";
import { CheckCircleIcon, ExclamationTriangleIcon } from "./Icons";

/**
 * Network Status Indicator
 * Shows a banner when user is offline or has connection issues
 */
export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineBanner, setShowOfflineBanner] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineBanner(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineBanner(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Auto-hide banner after reconnection
  useEffect(() => {
    if (isOnline && showOfflineBanner) {
      const timer = setTimeout(() => {
        setShowOfflineBanner(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, showOfflineBanner]);

  if (!showOfflineBanner) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-3 text-center text-sm font-medium transition-colors ${
        isOnline ? "bg-green-500 text-white" : "bg-red-500 text-white"
      }`}
      role="alert"
    >
      {isOnline ? (
        <>
          <CheckCircleIcon className="inline w-4 h-4 mr-2" />
          Đã kết nối lại internet
        </>
      ) : (
        <>
          <ExclamationTriangleIcon className="inline w-4 h-4 mr-2" />
          Mất kết nối internet. Vui lòng kiểm tra kết nối mạng.
        </>
      )}
    </div>
  );
}

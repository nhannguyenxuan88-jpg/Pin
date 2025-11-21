import React, { useState } from "react";
import { WrenchScrewdriverIcon, CpuChipIcon } from "./common/Icons";
import Logo from "./common/Logo";
import {
  runNetworkDiagnostics,
  formatDiagnosticResults,
} from "../lib/utils/networkDiagnostics";
import { TroubleshootingTips } from "./common/TroubleshootingTips";

interface LoginProps {
  onLogin: (email: string, password: string) => Promise<{ error: any }>;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: loginError } = await onLogin(email, password);
      if (loginError) {
        const errorMsg = loginError?.message || "";
        if (
          errorMsg.includes("CONNECTION") ||
          errorMsg.includes("TIMED_OUT") ||
          errorMsg.includes("ECONNREFUSED") ||
          errorMsg.includes("ERR_NETWORK")
        ) {
          setError(
            "Không thể kết nối đến server. Vui lòng kiểm tra kết nối internet và thử lại."
          );
        } else if (errorMsg.includes("Invalid login credentials")) {
          setError("Email hoặc mật khẩu không đúng. Vui lòng thử lại.");
        } else if (errorMsg.includes("Email not confirmed")) {
          setError("Email chưa được xác thực. Vui lòng kiểm tra email.");
        } else {
          setError(
            "Không thể đăng nhập. Vui lòng kiểm tra thông tin và thử lại."
          );
        }
      }
    } catch (e: any) {
      const errorMsg = e?.message || "";
      if (
        errorMsg.includes("Failed to fetch") ||
        errorMsg.includes("NetworkError") ||
        errorMsg.includes("net::ERR")
      ) {
        setError(
          "❌ Lỗi kết nối mạng. Vui lòng kiểm tra:\n" +
            "• Kết nối internet\n" +
            "• Firewall/VPN\n" +
            "• Thử refresh trang (F5)"
        );
      } else {
        setError("Đã xảy ra lỗi không mong đợi. Vui lòng thử lại.");
      }
    }
    setLoading(false);
  };

  const handleDiagnostics = async () => {
    setDiagnosing(true);
    setShowDiagnostics(true);
    try {
      const results = await runNetworkDiagnostics();
      const formatted = formatDiagnosticResults(results);
      console.log(formatted);

      const hasErrors = results.some((r) => r.status === "error");
      if (hasErrors) {
        const failedChecks = results.filter((r) => r.status === "error");
        setError(
          "⚠️ Phát hiện vấn đề kết nối:\n\n" +
            failedChecks.map((r) => `• ${r.check}: ${r.message}`).join("\n") +
            "\n\nVui lòng xem Console (F12) để biết chi tiết."
        );
      } else {
        setError(
          "✅ Tất cả kiểm tra đều OK!\n\nNếu vẫn không đăng nhập được, vui lòng:\n• Kiểm tra email/mật khẩu\n• Xóa cache trình duyệt (Ctrl+Shift+Del)\n• Thử trình duyệt khác"
        );
      }
    } catch (e: any) {
      setError("Không thể chạy diagnostics: " + e.message);
    }
    setDiagnosing(false);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 font-sans relative z-50">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 space-y-8">
        <div className="flex flex-col items-center">
          <Logo size={56} className="mb-3" rounded />
          <div className="bg-sky-600 p-3 rounded-full mb-4 sm:hidden">
            {/* Accent icon on very small screens */}
            <WrenchScrewdriverIcon className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">
            PinCorp
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            Đăng nhập vào tài khoản của bạn
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-slate-900 dark:text-slate-200"
              required
              autoFocus
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Mật khẩu
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500 text-slate-900 dark:text-slate-200"
              required
            />
          </div>

          {error && (
            <>
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400 whitespace-pre-line">
                  {error}
                </p>
              </div>
              <TroubleshootingTips error={error} />
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-colors disabled:bg-sky-400"
          >
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>

          <button
            type="button"
            onClick={handleDiagnostics}
            disabled={diagnosing}
            className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-colors disabled:opacity-50"
          >
            <CpuChipIcon className="w-4 h-4" />
            {diagnosing ? "Đang kiểm tra..." : "Kiểm tra kết nối"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;

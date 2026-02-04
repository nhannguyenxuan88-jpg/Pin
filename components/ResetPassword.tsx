import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

function parseHashParams(hash: string) {
  // hash like: #/reset-password?access_token=...&type=recovery
  const qIndex = hash.indexOf("?");
  if (qIndex === -1) return {} as Record<string, string>;
  const qs = hash.slice(qIndex + 1);
  return Object.fromEntries(new URLSearchParams(qs));
}

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // If the recovery token is present in the URL (hash after #), set session so SDK can use it
    (async () => {
      try {
        const hashParams = parseHashParams(window.location.hash || "");
        const token =
          hashParams["access_token"] ||
          new URLSearchParams(window.location.search).get("access_token");
        const refresh =
          hashParams["refresh_token"] ||
          new URLSearchParams(window.location.search).get("refresh_token");
        if (token && refresh) {
          // set session so supabase.auth.updateUser will work
          await supabase.auth.setSession({
            access_token: token,
            refresh_token: refresh,
          });
          // Remove token from URL to avoid leaking it (clean hash keeping path)
          try {
            const cleanHash = window.location.hash.split("?")[0] || "#";
            window.history.replaceState(
              null,
              "",
              window.location.pathname + window.location.search + cleanHash
            );
          } catch (e) {
            console.debug("ResetPassword: could not clean URL hash", e);
          }
        }
      } catch (e: any) {
        // Not fatal; user can still enter password if session exists
        console.debug(
          "ResetPassword: could not set session from token",
          e?.message || e
        );
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!password || password.length < 6)
      return setError("Mật khẩu phải ít nhất 6 ký tự.");
    if (password !== confirm)
      return setError("Mật khẩu và xác nhận không khớp.");

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message || String(error));
      } else {
        setMessage("Đổi mật khẩu thành công. Chuyển về trang đăng nhập...");
        setTimeout(() => {
          navigate("/login");
        }, 1200);
      }
    } catch (e: any) {
      setError(e?.message || "Đã xảy ra lỗi");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold mb-2">Đặt lại mật khẩu</h2>
        <p className="text-sm text-slate-500 mb-4">
          Nhập mật khẩu mới cho tài khoản của bạn.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm">Mật khẩu mới</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border rounded mt-1 bg-white dark:bg-slate-700"
            />
          </div>
          <div>
            <label className="text-sm">Xác nhận mật khẩu</label>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full p-2 border rounded mt-1 bg-white dark:bg-slate-700"
            />
          </div>
          {message && (
            <div className="p-3 bg-green-50 text-green-700 rounded">
              {message}
            </div>
          )}
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded">{error}</div>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-sky-600 text-white py-2 rounded"
            >
              {loading ? "Đang lưu..." : "Đặt lại mật khẩu"}
            </button>
            <a
              href="#/login"
              className="flex-1 text-center py-2 rounded border bg-white dark:bg-slate-700"
            >
              Quay lại
            </a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;

import React, { useState } from "react";
import { supabase } from "../supabaseClient";

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/#/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) {
        setError(error.message);
      } else {
        setMessage(
          "Email đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư (và spam)."
        );
      }
    } catch (e: any) {
      setError(e?.message || "Đã xảy ra lỗi");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold mb-2">Quên mật khẩu</h2>
        <p className="text-sm text-slate-500 mb-4">
          Nhập email để nhận link đặt lại mật khẩu.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              {loading ? "Đang gửi..." : "Gửi email"}
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

export default ForgotPassword;

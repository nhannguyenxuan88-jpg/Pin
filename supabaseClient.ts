// FIX: Removed reference to 'vite/client' as it was causing a type error.
// Global types for import.meta.env are now defined in `types.ts`.

import { createClient } from "@supabase/supabase-js";

// =====================================================================================
// ENVIRONMENT CONFIGURATION
// =====================================================================================
// SECURITY: The Supabase URL and Key MUST be set via environment variables
// Never commit real credentials to the repository!
//
// Setup:
// 1. Copy .env.example to .env.local
// 2. Add your Supabase credentials
// 3. Restart dev server
// =====================================================================================

const supabaseUrl =
  import.meta.env?.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey =
  import.meta.env?.VITE_SUPABASE_ANON_KEY || "placeholder-anon-key";

// Offline mode detection (for development only)
export const IS_OFFLINE_MODE = supabaseUrl.includes("placeholder");

// =====================================================================================
// PRODUCTION SECURITY CHECK
// =====================================================================================
// CRITICAL: Prevent deployment with placeholder credentials
// This will cause the app to fail immediately in production if not configured properly
// =====================================================================================
if (import.meta.env.PROD && IS_OFFLINE_MODE) {
  throw new Error(
    "PRODUCTION BUILD ERROR: Supabase credentials not configured!\n" +
      "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.\n" +
      "Offline mode is only allowed in development builds."
  );
}

// Development warning
if (IS_OFFLINE_MODE && !import.meta.env.PROD) {
  console.warn(
    "⚠️ DEVELOPMENT MODE: Running in offline mode\n" +
      "Supabase URL or Anon Key not set in environment variables.\n" +
      "The application will not connect to a real database.\n" +
      "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local to enable database access."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: {
      "X-Client-Info": "pincorp-app",
    },
  },
  db: {
    schema: "public",
  },
  // Add timeout for network requests
  realtime: {
    timeout: 10000, // 10 seconds
  },
});

// =====================================================================================
// DEV AUTH BYPASS (LOCAL ONLY)
// =====================================================================================
// Mục đích: Cho phép bỏ qua đăng nhập khi chạy local để test nhanh UI/logic.
// Cách bật:
// - Đặt biến môi trường VITE_DEV_AUTH_BYPASS=1 rồi build/dev, hoặc
// - Tại màn hình Login, nhấn nút "Bỏ qua đăng nhập (DEV)" để set localStorage cờ bật.
// Lưu ý: Chỉ nên dùng trên localhost.

function isLocalhost(): boolean {
  try {
    return (
      typeof window !== "undefined" && window.location.hostname === "localhost"
    );
  } catch {
    return false;
  }
}

function getLocalBypassFlag(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      window.localStorage.getItem("DEV_AUTH_BYPASS") === "1"
    );
  } catch {
    return false;
  }
}

export const DEV_AUTH_BYPASS: boolean =
  ((import.meta as any)?.env?.VITE_DEV_AUTH_BYPASS === "1" ||
    getLocalBypassFlag()) &&
  isLocalhost();

/**
 * Check whether Supabase is configured with real credentials
 * @returns true if real credentials are set, false if using placeholders
 */
export function isSupabaseConfigured(): boolean {
  return (
    !IS_OFFLINE_MODE &&
    !!supabaseAnonKey &&
    !supabaseAnonKey.includes("placeholder")
  );
}

/**
 * Wrap a Supabase query with timeout
 * @param promise The Supabase query promise
 * @param timeoutMs Timeout in milliseconds (default: 15 seconds)
 * @returns Promise that rejects if timeout is exceeded
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 15000
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(
        new Error(
          `Request timeout after ${timeoutMs}ms. ` +
            "Vui lòng kiểm tra kết nối internet và thử lại."
        )
      );
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutHandle!);
    return result;
  } catch (error) {
    clearTimeout(timeoutHandle!);
    throw error;
  }
}

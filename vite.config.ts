import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    server: {
      port: 3004,
      host: "0.0.0.0",
      hmr: {
        overlay: false,
      },
      watch: {
        usePolling: true,
        ignored: ["**/node_modules/**", "**/.git/**", "**/dist/**"],
      },
      middlewareMode: false,
    },
    plugins: [react()],
    define: {
      "process.env.API_KEY": JSON.stringify(env.GEMINI_API_KEY),
      "process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY),
    },
    optimizeDeps: {
      include: ["react", "react-dom"],
    },
    resolve: {
      dedupe: ["react", "react-dom"],
      alias: {
        "@": path.resolve(__dirname, "."),
        react: path.resolve(__dirname, "node_modules/react"),
        "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      },
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendor chunks - tách các thư viện lớn
            "vendor-react": ["react", "react-dom", "react-router-dom"],
            "vendor-query": ["@tanstack/react-query"],
            "vendor-charts": ["recharts"],
            "vendor-date": ["date-fns"],
            "vendor-supabase": ["@supabase/supabase-js"],
          },
        },
      },
    },
  };
});

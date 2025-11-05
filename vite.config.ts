import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    server: {
      port: 3002,
      host: "0.0.0.0",
      hmr: {
        host: "localhost",
        protocol: "ws",
        port: 3002,
        clientPort: 3002,
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
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
  };
});

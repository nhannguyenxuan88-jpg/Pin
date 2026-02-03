import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { PinProviderStandalone } from "./contexts/PinProviderStandalone";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { NetworkStatus } from "./components/common/NetworkStatus";
import { DialogProvider } from "./components/common/ConfirmDialog";
import { errorMonitoring } from "./lib/services/ErrorMonitoringService";
import App from "./App";
import "./src/index.css";

// Initialize error monitoring
errorMonitoring.init({
  enabled: import.meta.env.PROD,
  environment: import.meta.env.DEV ? 'development' : 'production',
});

// DEV: toggle diagnostic outlines with Shift + D
if (import.meta.env.DEV) {
  const toggleDebug = (e: KeyboardEvent) => {
    if ((e.key === "d" || e.key === "D") && e.shiftKey) {
      document.documentElement.classList.toggle("__debug");
      console.info(
        document.documentElement.classList.contains("__debug")
          ? "Diagnostic mode: ON (outlines and fixed-layer highlights enabled)"
          : "Diagnostic mode: OFF"
      );
    }
  };
  window.addEventListener("keydown", toggleDebug);

  // Auto-enable with ?debug=1 or #debug in URL
  const urlHasDebugParam =
    new URLSearchParams(window.location.search).get("debug") === "1" ||
    window.location.hash.toLowerCase().includes("debug");
  if (urlHasDebugParam) {
    document.documentElement.classList.add("__debug");
    console.info("Diagnostic mode: ON via URL param");
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: 3,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      networkMode: "online",
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {/* Background layer (behind app content) */}
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            // Ensure this layer never covers content
            zIndex: -1,
            background: "var(--pin-app-bg, #0f172a)",
            pointerEvents: "none",
          }}
          aria-hidden="true"
        />
        <NetworkStatus />
        <DialogProvider>
          <PinProviderStandalone>
            <App />
          </PinProviderStandalone>
        </DialogProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

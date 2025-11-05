import React, { useEffect, useState, Suspense } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase, IS_OFFLINE_MODE, DEV_AUTH_BYPASS } from "./supabaseClient";
import { usePinStandaloneContext } from "./contexts/PinProviderStandalone";
import PinCorpApp from "./components/PinCorpApp";
import Login from "./components/Login";
import ForgotPassword from "./components/ForgotPassword";
import ResetPassword from "./components/ResetPassword";

const LoadingFallback: React.FC = () => (
  <div className="flex h-screen w-screen items-center justify-center bg-slate-100 dark:bg-slate-900">
    <div className="flex items-center text-slate-500 dark:text-slate-400">
      <svg
        className="animate-spin -ml-1 mr-3 h-5 w-5"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      <span>Đang tải...</span>
    </div>
  </div>
);

const AppPin: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { currentUser } = usePinStandaloneContext();

  useEffect(() => {
    if (IS_OFFLINE_MODE || DEV_AUTH_BYPASS) {
      const fakeSession = {
        access_token: "fake-token",
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: "fake-refresh-token",
        user: {
          id: DEV_AUTH_BYPASS ? "dev-bypass-user" : "fake-user-id",
          app_metadata: {},
          user_metadata: {
            name: DEV_AUTH_BYPASS ? "Dev Bypass User" : "Offline User",
          },
          aud: "authenticated",
          email: DEV_AUTH_BYPASS ? "dev@localhost" : "offline@example.com",
          created_at: new Date().toISOString(),
        },
      } as any;
      setSession(fakeSession);
      setAuthLoading(false);
      return;
    }
    setAuthLoading(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (authLoading) return <LoadingFallback />;

  if (!session || !currentUser) {
    return (
      <HashRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <Login
                onLogin={(email, password) =>
                  supabase.auth.signInWithPassword({ email, password }) as any
                }
              />
            }
          />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/"
            element={
              <Login
                onLogin={(email, password) =>
                  supabase.auth.signInWithPassword({ email, password }) as any
                }
              />
            }
          />
        </Routes>
      </HashRouter>
    );
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      <PinCorpApp onSwitchApp={() => {}} />
    </Suspense>
  );
};

export default AppPin;

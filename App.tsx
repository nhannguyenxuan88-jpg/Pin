import React, { useEffect, useState, Suspense } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase, IS_OFFLINE_MODE, DEV_AUTH_BYPASS } from "./supabaseClient";
import { usePinStandaloneContext } from "./contexts/PinProviderStandalone";
import PinCorpApp from "./components/PinCorpApp";
import Login from "./components/Login";
import ForgotPassword from "./components/ForgotPassword";
import ResetPassword from "./components/ResetPassword";
import { LoadingSpinner } from "./components/common/Icons";

const LoadingFallback: React.FC = () => (
  <div className="flex h-screen w-screen items-center justify-center bg-slate-100 dark:bg-slate-900">
    <div className="flex items-center text-slate-500 dark:text-slate-400">
      <LoadingSpinner className="animate-spin -ml-1 mr-3 h-5 w-5 text-slate-500 dark:text-slate-400" />
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
          {/* Catch-all route: redirect any unmatched routes to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </HashRouter>
    );
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      <PinCorpApp onSwitchApp={() => { }} />
    </Suspense>
  );
};

export default AppPin;

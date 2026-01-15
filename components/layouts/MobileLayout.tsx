import React, { useState } from "react";
import { MobileHeader } from "../mobile/MobileHeader";
import { MobileDrawer } from "../mobile/MobileDrawer";
import { MobileBottomNav } from "../mobile/MobileBottomNav";
import { MobileMoreMenu } from "../mobile/MobileMoreMenu";
import { TetBanner, TetDecorations } from "../common/TetBanner";
import { useLocation } from "react-router-dom";
import type { CurrentUser } from "../../contexts/types";

interface MobileLayoutProps {
  children: React.ReactNode;
  currentUser: CurrentUser;
  onSwitchApp: () => void;
}

export const MobileLayout: React.FC<MobileLayoutProps> = ({
  children,
  currentUser,
  onSwitchApp,
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const location = useLocation();

  // Check if we're on the "more" page
  React.useEffect(() => {
    if (location.pathname === "/more") {
      setIsMoreMenuOpen(true);
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Tết 2026 Banner */}
      <TetBanner />

      {/* Mobile Header */}
      <MobileHeader
        currentUser={currentUser}
        onMenuOpen={() => setIsDrawerOpen(true)}
        showSearch={true}
      />

      {/* Side Drawer */}
      <MobileDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        currentUser={currentUser}
        onSwitchApp={onSwitchApp}
      />

      {/* Main Content - with padding for header and bottom nav */}
      <main className="pt-14 pb-20 min-h-screen">
        <div className="px-3 py-3">{children}</div>
      </main>

      {/* Bottom Navigation */}
      <MobileBottomNav />

      {/* More Menu (Sheet) */}
      <MobileMoreMenu
        isOpen={isMoreMenuOpen}
        onClose={() => {
          setIsMoreMenuOpen(false);
          if (location.pathname === "/more") {
            window.history.back();
          }
        }}
      />

      {/* Tết Decorations */}
      <TetDecorations />
    </div>
  );
};

export default MobileLayout;


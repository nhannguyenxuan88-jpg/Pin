import React from "react";
import { PinTopNav } from "../PinSidebar";
import { TetBanner, TetDecorations } from "../common/TetBanner";
import type { CurrentUser } from "../../contexts/types";

interface DesktopLayoutProps {
  children: React.ReactNode;
  currentUser: CurrentUser;
  onSwitchApp: () => void;
}

export const DesktopLayout: React.FC<DesktopLayoutProps> = ({
  children,
  currentUser,
  onSwitchApp,
}) => {
  return (
    <div className="flex flex-col h-screen bg-pin-gray-100 dark:bg-pin-gray-900 font-sans">
      {/* Tết 2026 Banner */}
      <div className="print:hidden">
        <TetBanner />
      </div>

      {/* Desktop Top Nav */}
      <div className="print:hidden">
        <PinTopNav currentUser={currentUser} onSwitchApp={onSwitchApp} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0">
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1400px] px-3 lg:px-6 py-4 lg:py-6">
            {children}
          </div>
        </main>
      </div>

      {/* Tết Decorations */}
      <TetDecorations />
    </div>
  );
};

export default DesktopLayout;


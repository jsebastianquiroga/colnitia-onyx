"use client";

import React from "react";
import useScreenSize from "@/hooks/useScreenSize";
import AppSidebar from "@/sections/sidebar/AppSidebar";
import MobileShell from "@/layouts/MobileShell";
import { TABLET_BREAKPOINT_PX } from "@/lib/constants";

interface AppLayoutSwitcherProps {
  children: React.ReactNode;
}

/**
 * Client component that switches between desktop layout (with AppSidebar)
 * and MobileShell based on screen size.
 *
 * AppSidebar is never mounted on mobile/tablet to avoid its DnD-kit sensors,
 * SWR hooks, and modal state from initializing.
 */
const AppLayoutSwitcher = React.memo(function AppLayoutSwitcher({
  children,
}: AppLayoutSwitcherProps) {
  const { isMobile, isTablet } = useScreenSize();

  const useMobileLayout = isMobile || isTablet;

  return (
    <>
      {/* Hide sidebar on small viewports before JS runs to prevent flash */}
      <style>{`
        @media (max-width: ${TABLET_BREAKPOINT_PX}px) {
          [data-testid="desktop-layout-sidebar"] {
            display: none !important;
          }
        }
      `}</style>

      {useMobileLayout ? (
        <MobileShell>{children}</MobileShell>
      ) : (
        <div className="flex flex-row w-full h-full overflow-hidden">
          <div data-testid="desktop-layout-sidebar">
            <AppSidebar />
          </div>
          {children}
        </div>
      )}
    </>
  );
});

AppLayoutSwitcher.displayName = "AppLayoutSwitcher";

export default AppLayoutSwitcher;

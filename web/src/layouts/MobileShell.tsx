"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Route } from "next";
import { cn } from "@/lib/utils";
import useScreenSize from "@/hooks/useScreenSize";
import useSwipeGesture from "@/hooks/useSwipeGesture";
import BottomNav, { type MobileTab } from "@/components/mobile/BottomNav";
import MobileHeader from "@/layouts/MobileHeader";
import TabletSidebar from "@/layouts/TabletSidebar";
import TabErrorBoundary from "@/components/mobile/TabErrorBoundary";
import SearchTab from "@/components/mobile/tabs/SearchTab";
import HistoryTab from "@/components/mobile/tabs/HistoryTab";

interface MobileShellProps {
  children: React.ReactNode;
}

function deriveTabFromPathname(pathname: string): MobileTab {
  if (pathname.startsWith("/app/search")) return "search";
  if (pathname.startsWith("/app/history")) return "history";
  return "chat";
}

function MobileShell({ children }: MobileShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isMobile, isTablet } = useScreenSize();

  const [activeTab, setActiveTab] = useState<MobileTab>(() =>
    deriveTabFromPathname(pathname)
  );

  // Track which tabs have been visited for lazy mounting
  const [visitedTabs, setVisitedTabs] = useState<Set<MobileTab>>(
    () => new Set([deriveTabFromPathname(pathname)])
  );

  // Scroll position preservation
  const scrollPositions = useRef<Record<MobileTab, number>>({
    chat: 0,
    search: 0,
    history: 0,
  });
  const contentRefs = useRef<Record<MobileTab, HTMLDivElement | null>>({
    chat: null,
    search: null,
    history: null,
  });

  // Track whether tab was changed manually (not via URL navigation)
  const manualTabChange = useRef(false);

  // Sync active tab from external navigation (e.g. browser back/forward)
  useEffect(() => {
    if (manualTabChange.current) {
      manualTabChange.current = false;
      return;
    }
    const derived = deriveTabFromPathname(pathname);
    if (derived !== activeTab) {
      setActiveTab(derived);
      setVisitedTabs((prev) => new Set(prev).add(derived));
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tablet sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Swipe to open sidebar (tablet only)
  const sidebarSwipe = useSwipeGesture({
    edgeZone: 20,
    onSwipe: useCallback(
      (dir) => {
        if (isTablet && dir === "right") {
          setSidebarOpen(true);
        }
      },
      [isTablet]
    ),
  });

  const handleTabChange = useCallback(
    (tab: MobileTab) => {
      // Save current scroll position
      const currentRef = contentRefs.current[activeTab];
      if (currentRef) {
        scrollPositions.current[activeTab] = currentRef.scrollTop;
      }

      manualTabChange.current = true;
      setActiveTab(tab);
      setVisitedTabs((prev) => new Set(prev).add(tab));

      // Update URL
      if (tab === "chat") {
        // Keep current chat URL if we're already on a chat
        if (!pathname.startsWith("/app/chat")) {
          router.replace("/app");
        }
      } else if (tab === "search") {
        router.replace("/app/search" as Route);
      }
      // history tab does not have a URL route

      // Restore scroll position after tab switch
      requestAnimationFrame(() => {
        const nextRef = contentRefs.current[tab];
        if (nextRef) {
          nextRef.scrollTop = scrollPositions.current[tab];
        }
      });
    },
    [activeTab, pathname, router]
  );

  const handleSelectChat = useCallback(
    (chatId: string) => {
      setActiveTab("chat");
      setVisitedTabs((prev) => new Set(prev).add("chat"));
      router.replace(`/app/chat/${chatId}` as Route);
    },
    [router]
  );

  const handleNewChat = useCallback(() => {
    router.push("/app");
  }, [router]);

  const handleBack = useCallback(() => {
    manualTabChange.current = true;
    setActiveTab("history");
    setVisitedTabs((prev) => new Set(prev).add("history"));
  }, []);

  const isInChat = pathname.startsWith("/app/chat/");

  return (
    <div
      className="flex flex-col w-full h-full overflow-hidden"
      data-testid="MobileShell"
      {...(isTablet ? sidebarSwipe : {})}
    >
      {/* Reduced motion support */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          [data-testid="MobileShell"] * {
            transition: none !important;
          }
        }
        @keyframes mobile-sheet-slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .mobile-sheet-slide-up {
          animation: mobile-sheet-slide-up 200ms ease-out;
        }
      `}</style>

      <MobileHeader
        activeTab={activeTab}
        isInChat={isInChat && activeTab === "chat"}
        onBack={isInChat ? handleBack : undefined}
        onNewChat={handleNewChat}
        showMenuButton={isTablet}
        onMenuPress={() => setSidebarOpen(true)}
      />

      {/* Tab content */}
      <div className={cn("flex-1 overflow-hidden relative")}>
        {/* Chat tab - renders the children (page content) */}
        <div
          ref={(el) => {
            contentRefs.current.chat = el;
          }}
          className={cn(
            "absolute inset-0 overflow-y-auto",
            activeTab !== "chat" && "hidden"
          )}
          data-testid="MobileShell/chat-panel"
        >
          {children}
        </div>

        {/* Search tab */}
        {visitedTabs.has("search") && (
          <div
            ref={(el) => {
              contentRefs.current.search = el;
            }}
            className={cn(
              "absolute inset-0 overflow-y-auto",
              activeTab !== "search" && "hidden"
            )}
            data-testid="MobileShell/search-panel"
          >
            <TabErrorBoundary>
              <SearchTab isActive={activeTab === "search"} />
            </TabErrorBoundary>
          </div>
        )}

        {/* History tab */}
        {visitedTabs.has("history") && (
          <div
            ref={(el) => {
              contentRefs.current.history = el;
            }}
            className={cn(
              "absolute inset-0 overflow-y-auto",
              activeTab !== "history" && "hidden"
            )}
            data-testid="MobileShell/history-panel"
          >
            <TabErrorBoundary>
              <HistoryTab
                isActive={activeTab === "history"}
                onSelectChat={handleSelectChat}
              />
            </TabErrorBoundary>
          </div>
        )}
      </div>

      {/* Bottom nav (phone only) */}
      {isMobile && (
        <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
      )}

      {/* Tablet sidebar overlay */}
      {isTablet && (
        <TabletSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

export default MobileShell;

"use client";

import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { Text } from "@opal/components";
import { SvgBubbleText, SvgSearch, SvgHistory } from "@opal/icons";

export type MobileTab = "chat" | "search" | "history";

interface BottomNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

interface TabConfig {
  id: MobileTab;
  label: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
}

const TABS: TabConfig[] = [
  { id: "chat", label: "Chat", icon: SvgBubbleText },
  { id: "search", label: "Buscar", icon: SvgSearch },
  { id: "history", label: "Historial", icon: SvgHistory },
];

function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav
      data-testid="MobileBottomNav"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        "bg-background-neutral-01 border-t border-border-02",
        "flex items-center justify-around",
        "h-[56px]",
        "pb-[env(safe-area-inset-bottom)]"
      )}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <BottomNavTab
            key={tab.id}
            tab={tab}
            isActive={isActive}
            onPress={onTabChange}
          />
        );
      })}
    </nav>
  );
}

interface BottomNavTabProps {
  tab: TabConfig;
  isActive: boolean;
  onPress: (tab: MobileTab) => void;
}

function BottomNavTab({ tab, isActive, onPress }: BottomNavTabProps) {
  const Icon = tab.icon;

  const handleClick = useCallback(() => {
    onPress(tab.id);
  }, [onPress, tab.id]);

  return (
    <button
      data-testid={`MobileBottomNav/${tab.id}`}
      type="button"
      onClick={handleClick}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5",
        "min-w-[44px] min-h-[44px]",
        "flex-1"
      )}
    >
      <Icon
        className={cn(
          "w-5 h-5",
          isActive ? "text-text-01" : "text-text-03"
        )}
      />
      {isActive && (
        <div className="w-1 h-1 rounded-full bg-theme-primary-05" />
      )}
      <Text
        font="secondary-action"
        color={isActive ? "text-01" : "text-03"}
      >
        {tab.label}
      </Text>
    </button>
  );
}

export default BottomNav;

"use client";

import { cn } from "@/lib/utils";
import { Button } from "@opal/components";
import { Text } from "@opal/components";
import { SvgArrowLeft, SvgEditBig } from "@opal/icons";
import { ColnitiaLogo } from "@/lib/colnitia/ColnitiaLogo";
import type { MobileTab } from "@/components/mobile/BottomNav";

interface MobileHeaderProps {
  activeTab: MobileTab;
  chatName?: string;
  isInChat: boolean;
  onBack?: () => void;
  onNewChat: () => void;
  /** For tablet: show hamburger to open sidebar */
  showMenuButton?: boolean;
  onMenuPress?: () => void;
}

function MobileHeader({
  activeTab,
  chatName,
  isInChat,
  onBack,
  onNewChat,
  showMenuButton,
  onMenuPress,
}: MobileHeaderProps) {
  return (
    <header
      className={cn(
        "flex items-center justify-between px-3",
        "h-[48px] min-h-[48px]",
        "bg-background-neutral-01 border-b border-border-02"
      )}
      data-testid="MobileHeader"
    >
      {/* Left side */}
      <div className="flex items-center gap-2">
        {showMenuButton && (
          <Button
            variant="default"
            prominence="tertiary"
            size="sm"
            onClick={onMenuPress}
          >
            {"\u2630"}
          </Button>
        )}
        {isInChat && onBack ? (
          <Button
            variant="default"
            prominence="tertiary"
            icon={SvgArrowLeft}
            size="sm"
            onClick={onBack}
          />
        ) : (
          <ColnitiaLogo size={24} />
        )}
        {isInChat && chatName && (
          <Text font="main-ui-action" color="text-01" nowrap>
            {chatName.length > 25 ? `${chatName.slice(0, 25)}...` : chatName}
          </Text>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center">
        {activeTab === "chat" && (
          <Button
            variant="default"
            prominence="tertiary"
            icon={SvgEditBig}
            size="sm"
            onClick={onNewChat}
            data-testid="MobileHeader/new-chat"
          />
        )}
      </div>
    </header>
  );
}

export default MobileHeader;

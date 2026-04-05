"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { cn } from "@/lib/utils";
import { Text, Button } from "@opal/components";
import { SvgEditBig, SvgX } from "@opal/icons";
import useChatSessions from "@/hooks/useChatSessions";
import { useAgents } from "@/hooks/useAgents";
import { ColnitiaLogo } from "@/lib/colnitia/ColnitiaLogo";
import { UNNAMED_CHAT } from "@/lib/constants";

interface TabletSidebarProps {
  open: boolean;
  onClose: () => void;
}

function TabletSidebar({ open, onClose }: TabletSidebarProps) {
  const router = useRouter();
  const { chatSessions } = useChatSessions();
  const { agents } = useAgents();

  const handleNewChat = useCallback(() => {
    router.push("/app");
    onClose();
  }, [router, onClose]);

  const handleSelectChat = useCallback(
    (chatId: string) => {
      router.push(`/app/chat/${chatId}` as Route);
      onClose();
    },
    [router, onClose]
  );

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-background-neutral-05/60"
          onClick={onClose}
          data-testid="TabletSidebar/backdrop"
        />
      )}
      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[300px]",
          "bg-background-neutral-01 border-r border-border-02",
          "transition-transform duration-250 ease-in-out",
          "motion-reduce:transition-none",
          open ? "translate-x-0" : "-translate-x-[300px]"
        )}
        data-testid="TabletSidebar"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 h-[48px] border-b border-border-02">
          <ColnitiaLogo size={24} />
          <div className="flex items-center gap-1">
            <Button
              variant="default"
              prominence="tertiary"
              icon={SvgEditBig}
              size="sm"
              onClick={handleNewChat}
            />
            <Button
              variant="default"
              prominence="tertiary"
              icon={SvgX}
              size="sm"
              onClick={onClose}
            />
          </div>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-2 py-2">
            <Text font="secondary-action" color="text-03" as="p">
              Recientes
            </Text>
          </div>
          {chatSessions.slice(0, 50).map((session) => (
            <button
              key={session.id}
              type="button"
              className={cn(
                "flex items-center w-full px-3 py-2 text-left",
                "min-h-[44px]",
                "active:bg-background-tint-02",
                "rounded-lg"
              )}
              onClick={() => handleSelectChat(session.id)}
            >
              <Text font="main-ui-body" color="text-01" nowrap>
                {(session.name || UNNAMED_CHAT).slice(0, 30)}
              </Text>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export default TabletSidebar;

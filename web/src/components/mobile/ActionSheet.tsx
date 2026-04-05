"use client";

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Text } from "@opal/components";

export interface ActionSheetAction {
  label: string;
  icon?: React.FC<React.SVGProps<SVGSVGElement>>;
  destructive?: boolean;
  onPress: () => void;
}

interface ActionSheetProps {
  open: boolean;
  onClose: () => void;
  actions: ActionSheetAction[];
}

function ActionSheet({ open, onClose, actions }: ActionSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50" data-testid="ActionSheet">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background-neutral-05/60"
        onClick={handleBackdropClick}
      />
      {/* Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          "absolute bottom-0 left-0 right-0",
          "bg-background-neutral-01 border-t border-border-02",
          "rounded-t-2xl",
          "pb-[env(safe-area-inset-bottom)]",
          "mobile-sheet-slide-up"
        )}
      >
        {/* Handle */}
        <div className="flex justify-center py-2">
          <div className="w-8 h-1 rounded-full bg-border-03" />
        </div>
        {/* Actions */}
        <div className="flex flex-col pb-2">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={cn(
                "flex items-center gap-3 px-4 py-3",
                "min-h-[44px]",
                "active:bg-background-tint-02"
              )}
              onClick={() => {
                action.onPress();
                onClose();
              }}
            >
              {action.icon && (
                <action.icon
                  className={cn(
                    "w-5 h-5",
                    action.destructive
                      ? "text-action-danger-01"
                      : "text-text-01"
                  )}
                />
              )}
              {action.destructive ? (
                <span className="text-action-danger-01">
                  <Text font="main-ui-action" color="inherit">
                    {action.label}
                  </Text>
                </span>
              ) : (
                <Text font="main-ui-action" color="text-01">
                  {action.label}
                </Text>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ActionSheet;

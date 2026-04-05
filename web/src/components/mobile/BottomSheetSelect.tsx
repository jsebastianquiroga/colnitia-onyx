"use client";

import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Text } from "@opal/components";
import { SvgCheck } from "@opal/icons";

export interface BottomSheetOption {
  id: string;
  label: string;
  description?: string;
  icon?: React.FC<React.SVGProps<SVGSVGElement>>;
}

interface BottomSheetSelectProps {
  open: boolean;
  onClose: () => void;
  title: string;
  options: BottomSheetOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function BottomSheetSelect({
  open,
  onClose,
  title,
  options,
  selectedId,
  onSelect,
}: BottomSheetSelectProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id);
      onClose();
    },
    [onSelect, onClose]
  );

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50" data-testid="BottomSheetSelect">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background-neutral-05/60"
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0",
          "bg-background-neutral-01 border-t border-border-02",
          "rounded-t-2xl",
          "pb-[env(safe-area-inset-bottom)]",
          "max-h-[60vh] overflow-y-auto",
          "mobile-sheet-slide-up"
        )}
      >
        {/* Handle */}
        <div className="flex justify-center py-2">
          <div className="w-8 h-1 rounded-full bg-border-03" />
        </div>
        {/* Title */}
        <div className="px-4 pb-2">
          <Text font="main-ui-action" color="text-01">
            {title}
          </Text>
        </div>
        {/* Options */}
        <div className="flex flex-col pb-2">
          {options.map((option) => {
            const isSelected = option.id === selectedId;
            return (
              <button
                key={option.id}
                type="button"
                className={cn(
                  "flex items-center gap-3 px-4 py-3",
                  "min-h-[44px]",
                  "active:bg-background-tint-02",
                  isSelected && "bg-background-tint-02"
                )}
                onClick={() => handleSelect(option.id)}
              >
                {option.icon && (
                  <option.icon className="w-5 h-5 text-text-02" />
                )}
                <div className="flex flex-col flex-1 text-left">
                  <Text font="main-ui-action" color="text-01">
                    {option.label}
                  </Text>
                  {option.description && (
                    <Text font="secondary-body" color="text-03">
                      {option.description}
                    </Text>
                  )}
                </div>
                {isSelected && (
                  <SvgCheck className="w-5 h-5 text-theme-primary-05" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default BottomSheetSelect;

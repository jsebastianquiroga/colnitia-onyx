"use client";

import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Button } from "@opal/components";
import { SvgX } from "@opal/icons";

interface ArtifactModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Full-screen modal overlay for artifacts/presentations on mobile.
 * Portal-based, z-50, with a prominent close button at top-right.
 */
function ArtifactModal({ open, onClose, children }: ArtifactModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50",
        "flex flex-col",
        "bg-background-neutral-01"
      )}
      data-testid="ArtifactModal"
    >
      {/* Close button */}
      <div className="flex justify-end p-2">
        <Button
          variant="default"
          prominence="tertiary"
          icon={SvgX}
          size="md"
          onClick={onClose}
          data-testid="ArtifactModal/close"
        />
      </div>
      {/* Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>,
    document.body
  );
}

export default ArtifactModal;

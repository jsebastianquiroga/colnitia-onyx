"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@opal/components";
import { SvgTrash } from "@opal/icons";

interface SwipeableItemProps {
  children: React.ReactNode;
  onDelete: () => void;
}

const SWIPE_THRESHOLD = 60;
const REVEAL_WIDTH = 80;

/**
 * Wraps a list item with swipe-left-to-reveal-delete behavior using native touch events.
 */
function SwipeableItem({ children, onDelete }: SwipeableItemProps) {
  const [offset, setOffset] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const trackingRef = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    startRef.current = { x: touch.clientX, y: touch.clientY };
    trackingRef.current = true;
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!trackingRef.current || !startRef.current) return;
      const touch = e.touches[0];
      if (!touch) return;

      const dx = touch.clientX - startRef.current.x;
      const dy = Math.abs(touch.clientY - startRef.current.y);

      // Cancel if vertical movement dominates
      if (dy > Math.abs(dx)) {
        trackingRef.current = false;
        setOffset(revealed ? -REVEAL_WIDTH : 0);
        return;
      }

      const base = revealed ? -REVEAL_WIDTH : 0;
      const newOffset = Math.min(0, Math.max(-REVEAL_WIDTH, base + dx));
      setOffset(newOffset);
    },
    [revealed]
  );

  const onTouchEnd = useCallback(() => {
    if (!trackingRef.current) return;
    trackingRef.current = false;

    if (Math.abs(offset) >= SWIPE_THRESHOLD) {
      setRevealed(true);
      setOffset(-REVEAL_WIDTH);
    } else {
      setRevealed(false);
      setOffset(0);
    }
  }, [offset]);

  return (
    <div className="relative overflow-hidden" data-testid="SwipeableItem">
      {/* Delete button behind */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 flex items-center justify-center",
          "bg-action-danger-02"
        )}
        style={{ width: REVEAL_WIDTH }}
      >
        <Button
          variant="danger"
          prominence="primary"
          icon={SvgTrash}
          size="sm"
          onClick={onDelete}
          data-testid="SwipeableItem/delete"
        />
      </div>
      {/* Content */}
      <div
        className="relative bg-background-neutral-01 transition-transform duration-150"
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}

export default SwipeableItem;

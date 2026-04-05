"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { SvgRefreshCw } from "@opal/icons";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

const PULL_THRESHOLD = 50;
const MAX_PULL = 80;

/**
 * Pull-to-refresh wrapper using native touch events.
 * The child content must be scrollable. Pull triggers when the scroll container
 * is at the top (scrollTop === 0).
 */
function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) return;
    const touch = e.touches[0];
    if (touch) {
      startYRef.current = touch.clientY;
    }
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (startYRef.current === null || refreshing) return;
      const touch = e.touches[0];
      if (!touch) return;
      const dy = touch.clientY - startYRef.current;
      if (dy > 0) {
        setPullDistance(Math.min(dy * 0.4, MAX_PULL));
      }
    },
    [refreshing]
  );

  const onTouchEnd = useCallback(async () => {
    if (startYRef.current === null) return;
    startYRef.current = null;

    if (pullDistance >= PULL_THRESHOLD && !refreshing) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    setPullDistance(0);
  }, [pullDistance, refreshing, onRefresh]);

  return (
    <div
      ref={containerRef}
      className="relative overflow-y-auto h-full"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      data-testid="PullToRefresh"
    >
      {/* Pull indicator */}
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden transition-[height] duration-150",
          refreshing && "animate-spin"
        )}
        style={{ height: pullDistance }}
      >
        {pullDistance > 10 && (
          <SvgRefreshCw
            className={cn(
              "w-5 h-5 text-text-03 transition-transform",
              pullDistance >= PULL_THRESHOLD && "text-theme-primary-05"
            )}
          />
        )}
      </div>
      {children}
    </div>
  );
}

export default PullToRefresh;

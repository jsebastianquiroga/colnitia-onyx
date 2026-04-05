"use client";

import { useCallback, useRef } from "react";

type SwipeDirection = "left" | "right";

interface UseSwipeGestureOptions {
  /** Minimum horizontal distance in px to qualify as a swipe. Default 60. */
  threshold?: number;
  /** If set, only start tracking when touchstart.x is within this many px of the left edge. */
  edgeZone?: number;
  /** Called when a valid swipe is detected. */
  onSwipe: (direction: SwipeDirection) => void;
}

interface UseSwipeGestureHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

/**
 * Generic left/right swipe detector using native touch events.
 * Horizontal swipes that exceed the threshold trigger `onSwipe`.
 */
export default function useSwipeGesture(
  options: UseSwipeGestureOptions
): UseSwipeGestureHandlers {
  const { threshold = 60, edgeZone, onSwipe } = options;
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const trackingRef = useRef(false);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      if (edgeZone !== undefined && touch.clientX > edgeZone) {
        trackingRef.current = false;
        return;
      }
      startRef.current = { x: touch.clientX, y: touch.clientY };
      trackingRef.current = true;
    },
    [edgeZone]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!trackingRef.current || !startRef.current) return;
      const touch = e.touches[0];
      if (!touch) return;
      const dx = Math.abs(touch.clientX - startRef.current.x);
      const dy = Math.abs(touch.clientY - startRef.current.y);
      // Cancel if vertical movement dominates
      if (dy > dx) {
        trackingRef.current = false;
      }
    },
    []
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!trackingRef.current || !startRef.current) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - startRef.current.x;
      if (Math.abs(dx) >= threshold) {
        onSwipe(dx > 0 ? "right" : "left");
      }
      trackingRef.current = false;
      startRef.current = null;
    },
    [threshold, onSwipe]
  );

  return { onTouchStart, onTouchMove, onTouchEnd };
}

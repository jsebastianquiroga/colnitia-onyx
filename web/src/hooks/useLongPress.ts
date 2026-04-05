"use client";

import { useCallback, useRef } from "react";

interface UseLongPressOptions {
  /** Duration in ms before the callback fires. Default 500. */
  duration?: number;
  /** Prevent subsequent mouse events from touch (hybrid device). Default true. */
  preventMouseFallthrough?: boolean;
}

interface UseLongPressHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
}

/**
 * Returns touch event handlers that fire `callback` after a long press (default 500ms).
 * Movement beyond 10px cancels the press.
 */
export default function useLongPress(
  callback: () => void,
  options?: UseLongPressOptions
): UseLongPressHandlers {
  const { duration = 500, preventMouseFallthrough = true } = options ?? {};
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (preventMouseFallthrough) {
        e.preventDefault();
      }
      const touch = e.touches[0];
      if (!touch) return;
      startPos.current = { x: touch.clientX, y: touch.clientY };
      clear();
      timerRef.current = setTimeout(() => {
        callback();
        timerRef.current = null;
      }, duration);
    },
    [callback, duration, preventMouseFallthrough, clear]
  );

  const onTouchEnd = useCallback(() => {
    clear();
  }, [clear]);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!startPos.current) return;
      const touch = e.touches[0];
      if (!touch) return;
      const dx = Math.abs(touch.clientX - startPos.current.x);
      const dy = Math.abs(touch.clientY - startPos.current.y);
      if (dx > 10 || dy > 10) {
        clear();
      }
    },
    [clear]
  );

  return { onTouchStart, onTouchEnd, onTouchMove };
}

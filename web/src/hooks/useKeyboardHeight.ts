"use client";

import { useState, useEffect } from "react";

/**
 * Tracks the height of the on-screen keyboard by observing `visualViewport` resize events.
 * Returns 0 when the keyboard is hidden or the API is unavailable.
 */
export default function useKeyboardHeight(): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    function handleResize() {
      const vv = window.visualViewport;
      if (!vv) return;
      // The keyboard intrusion is the difference between the window height
      // and the visual viewport height.
      const height = Math.max(0, window.innerHeight - vv.height);
      setKeyboardHeight(height);
    }

    vv.addEventListener("resize", handleResize);
    return () => vv.removeEventListener("resize", handleResize);
  }, []);

  return keyboardHeight;
}

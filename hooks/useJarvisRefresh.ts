"use client";

import { useEffect, useRef } from "react";

/**
 * Re-run a page's data loader whenever Jarvis mutates something (it dispatches a
 * `jarvis:changed` window event after creating/deleting/completing items). This
 * lets the page the user is looking at update in place, so Jarvis's actions are
 * visible immediately without a manual reload.
 */
export function useJarvisRefresh(reload: () => void) {
  const ref = useRef(reload);
  ref.current = reload;
  useEffect(() => {
    const handler = () => ref.current();
    window.addEventListener("jarvis:changed", handler);
    return () => window.removeEventListener("jarvis:changed", handler);
  }, []);
}

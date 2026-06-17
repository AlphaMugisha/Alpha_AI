"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevPath = useRef(pathname + searchParams.toString());

  useEffect(() => {
    const currentPath = pathname + searchParams.toString();

    if (currentPath !== prevPath.current) {
      // Navigation completed — finish the bar
      prevPath.current = currentPath;
      setWidth(100);
      const t = setTimeout(() => {
        setVisible(false);
        setWidth(0);
      }, 400);
      return () => clearTimeout(t);
    }
  }, [pathname, searchParams]);

  // Intercept link clicks to start the bar
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http") || href.startsWith("mailto")) return;

      setVisible(true);
      setWidth(10);

      // Simulate incremental progress
      let current = 10;
      timerRef.current = setInterval(() => {
        current += Math.random() * 15;
        if (current >= 85) {
          if (timerRef.current) clearInterval(timerRef.current);
          current = 85;
        }
        setWidth(current);
      }, 300);
    };

    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[9999] h-[3px] bg-transparent pointer-events-none"
        >
          <motion.div
            className="h-full bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 shadow-[0_0_10px_rgba(139,92,246,0.7)]"
            animate={{ width: `${width}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

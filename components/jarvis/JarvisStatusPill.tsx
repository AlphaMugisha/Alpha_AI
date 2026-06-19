"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useJarvis } from "@/context/JarvisContext";
import { cn } from "@/lib/utils";

/**
 * Ambient "Jarvis is on" indicator — a small pill at the bottom of the screen.
 * Shows while Jarvis is open (reflecting its state) AND, when hands-free is on,
 * even while closed ("listening for Hey Jarvis") so the user always knows the
 * mic is live.
 */
export function JarvisStatusPill() {
  const { open, handsFree, state } = useJarvis();
  const visible = open || handsFree;

  const dot =
    state === "listening"
      ? "bg-red-400"
      : state === "thinking"
        ? "bg-amber-400"
        : "bg-emerald-400";

  const label = open
    ? state === "listening"
      ? "Jarvis is listening"
      : state === "thinking"
        ? "Jarvis is thinking"
        : state === "speaking"
          ? "Jarvis is speaking"
          : "Jarvis is online"
    : "Listening for “Hey Jarvis”";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[80] pointer-events-none"
        >
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 text-white text-xs font-medium shadow-lg backdrop-blur border border-white/10">
            <span className="relative flex h-2 w-2">
              <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping", dot)} />
              <span className={cn("relative inline-flex rounded-full h-2 w-2", dot)} />
            </span>
            {label}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

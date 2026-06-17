"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/** A single flip-style digit that animates whenever its value changes. */
function FlipDigit({ value }: { value: string }) {
  return (
    <span className="relative inline-block w-[0.62em] overflow-hidden text-center">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: "-100%", opacity: 0, filter: "blur(4px)" }}
          animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
          exit={{ y: "100%", opacity: 0, filter: "blur(4px)" }}
          transition={{ type: "spring", stiffness: 360, damping: 28 }}
          className="inline-block"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Renders a zero-padded number as individually-animating digits. */
function FlipNumber({ value }: { value: number }) {
  const digits = value.toString().padStart(2, "0").split("");
  return (
    <span className="inline-flex">
      {digits.map((d, i) => (
        <FlipDigit key={i} value={d} />
      ))}
    </span>
  );
}

export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Avoid hydration mismatch — reserve space until mounted on the client.
  if (!now) {
    return <div className="h-[104px] w-[280px]" aria-hidden />;
  }

  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const isPM = hours >= 12;
  const displayHours = hours % 12 || 12;

  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      whileHover={{ scale: 1.03, y: -2 }}
      className="group relative flex flex-col items-center rounded-2xl border border-white/20 bg-white/10 px-5 py-3 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.12)] transition-colors hover:border-white/40 hover:bg-white/15"
    >
      {/* soft animated glow behind the panel */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-px -z-10 rounded-2xl bg-gradient-to-r from-fuchsia-400/30 via-violet-300/20 to-indigo-400/30 blur-md"
        animate={{ opacity: [0.35, 0.7, 0.35] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      <div
        className="flex items-baseline gap-2 font-mono tabular-nums tracking-tight"
        aria-label={`Current time ${displayHours}:${minutes
          .toString()
          .padStart(2, "0")} ${isPM ? "PM" : "AM"}`}
      >
        <span className="text-5xl md:text-6xl font-bold leading-none drop-shadow-sm">
          <FlipNumber value={displayHours} />
          <motion.span
            className="mx-0.5 inline-block text-violet-200"
            animate={{ opacity: [1, 0.15, 1] }}
            transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
          >
            :
          </motion.span>
          <FlipNumber value={minutes} />
        </span>

        <span className="flex flex-col items-start leading-none">
          <span className="flex items-center gap-1 text-xl md:text-2xl font-semibold text-violet-100">
            {/* breathing live indicator */}
            <motion.span
              className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.7)]"
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
            />
            <FlipNumber value={seconds} />
          </span>
          <span className="text-xs font-bold tracking-widest text-violet-200">
            {isPM ? "PM" : "AM"}
          </span>
        </span>
      </div>

      <motion.p
        key={dateLabel}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-1.5 text-sm font-medium text-violet-200"
      >
        {dateLabel}
      </motion.p>
    </motion.div>
  );
}

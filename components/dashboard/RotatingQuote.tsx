"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";

const QUOTES = [
  "Small steps every day add up to big results.",
  "The expert in anything was once a beginner.",
  "Focus on progress, not perfection.",
  "Learning a little each day beats cramming it all at once.",
  "Your future self will thank you for studying today.",
  "Understanding beats memorizing — ask “why”.",
  "Consistency is what turns effort into mastery.",
  "Done is better than perfect. Start now.",
];

export function RotatingQuote() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // Start on a random quote so it isn't the same every reload.
    setIndex(Math.floor(Math.random() * QUOTES.length));
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % QUOTES.length);
    }, 6000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mt-4 flex items-start gap-2.5 text-violet-100">
      <motion.span
        animate={{ rotate: [0, 15, -10, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="mt-0.5 shrink-0"
      >
        <Sparkles className="h-4 w-4 text-amber-300" />
      </motion.span>
      <div className="relative h-6 flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.p
            key={index}
            initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute inset-0 text-sm font-medium italic"
          >
            “{QUOTES[index]}”
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

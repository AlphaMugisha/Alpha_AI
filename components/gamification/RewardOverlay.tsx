"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RewardEvents, Rarity } from "@/lib/gamification/types";
import { Button } from "@/components/ui/button";
import { Sparkles, ChevronUp, Star, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const RARITY_RING: Record<Rarity, string> = {
  common: "from-slate-400 to-slate-500",
  rare: "from-blue-500 to-cyan-500",
  epic: "from-violet-500 to-fuchsia-500",
  legendary: "from-amber-400 to-orange-500",
};
const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

export function RewardOverlay({
  reward,
  onDismiss,
}: {
  reward: RewardEvents | null;
  onDismiss: () => void;
}) {
  const isModal = !!reward && (reward.leveledUp || reward.unlocked.length > 0);
  const isToast = !!reward && !isModal && reward.xpGained > 0;

  // XP-only rewards auto-dismiss as a subtle toast.
  useEffect(() => {
    if (!isToast) return;
    const t = setTimeout(onDismiss, 2200);
    return () => clearTimeout(t);
  }, [isToast, reward, onDismiss]);

  return (
    <>
      {/* Subtle XP toast */}
      <AnimatePresence>
        {isToast && reward && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[100]"
          >
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/30">
              <Zap className="w-4 h-4" />
              <span className="font-semibold text-sm">+{reward.xpGained} XP</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Celebration modal */}
      <AnimatePresence>
        {isModal && reward && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={onDismiss}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm rounded-2xl bg-card border shadow-2xl overflow-hidden"
            >
              {/* Glow */}
              <motion.div
                aria-hidden
                initial={{ opacity: 0.5, scale: 0.8 }}
                animate={{ opacity: [0.4, 0.7, 0.4], scale: [0.9, 1.1, 0.9] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-64 bg-violet-500/20 rounded-full blur-3xl"
              />

              <div className="relative p-7 text-center">
                {reward.leveledUp ? (
                  <>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1, rotate: [0, -8, 8, 0] }}
                      transition={{ delay: 0.1, type: "spring" }}
                      className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg mb-4"
                    >
                      <div className="text-center text-white">
                        <ChevronUp className="w-5 h-5 mx-auto -mb-1" />
                        <span className="text-2xl font-extrabold leading-none">
                          {reward.newLevel}
                        </span>
                      </div>
                    </motion.div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-violet-500">
                      Level Up
                    </p>
                    <h3 className="text-2xl font-bold mt-1">
                      You reached Level {reward.newLevel}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Keep the momentum going.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-widest text-violet-500">
                      Achievement Unlocked
                    </p>
                    <h3 className="text-xl font-bold mt-1">
                      {reward.unlocked.length > 1
                        ? `${reward.unlocked.length} achievements!`
                        : reward.unlocked[0]?.name}
                    </h3>
                  </>
                )}

                {/* Achievement chips (also shown alongside a level-up) */}
                {reward.unlocked.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {reward.unlocked.map((a) => (
                      <motion.div
                        key={a.key}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 p-2.5 rounded-xl border bg-muted/40 text-left"
                      >
                        <div
                          className={cn(
                            "w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-lg shrink-0",
                            RARITY_RING[a.rarity]
                          )}
                        >
                          {a.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold truncate">{a.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {a.description}
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0 flex items-center gap-1">
                          <Star className="w-3 h-3" />
                          {RARITY_LABEL[a.rarity]}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                )}

                {reward.xpGained > 0 && (
                  <div className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 text-sm font-semibold">
                    <Sparkles className="w-4 h-4" />+{reward.xpGained} XP earned
                  </div>
                )}

                <Button
                  onClick={onDismiss}
                  className="w-full mt-6 bg-gradient-to-r from-violet-600 to-indigo-600"
                >
                  Continue
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

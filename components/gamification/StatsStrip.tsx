"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useGamification } from "@/context/GamificationContext";
import { Card, CardContent } from "@/components/ui/card";
import { Flame, Star, Trophy, Target } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatsStrip() {
  const { game, weeklyChallenges, loading } = useGamification();

  if (loading && !game) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }
  if (!game) return null;

  const completedChallenges = weeklyChallenges.filter((c) => c.completed).length;
  const recent = game.recentAchievement;

  const widgets = [
    {
      label: "Current Streak",
      icon: Flame,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
      value: (
        <span>
          {game.streak.currentStreak}{" "}
          <span className="text-sm font-normal text-muted-foreground">days</span>
        </span>
      ),
      sub: game.streak.longestStreak > 0 ? `Best: ${game.streak.longestStreak}` : "Start today 🔥",
    },
    {
      label: "Current Level",
      icon: Star,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
      value: <span>Lvl {game.level}</span>,
      sub: game.isMax ? "Max level" : `${game.xpIntoLevel}/${game.xpForNextLevel} XP`,
      bar: game.isMax ? 100 : game.pct,
    },
    {
      label: "Recent Achievement",
      icon: Trophy,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      value: recent ? (
        <span className="text-lg flex items-center gap-1.5">
          <span>{recent.icon}</span>
          <span className="text-sm font-semibold truncate">{recent.name}</span>
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">None yet</span>
      ),
      sub: `${game.unlocked.length}/${game.achievements.length} unlocked`,
    },
    {
      label: "Weekly Progress",
      icon: Target,
      color: "text-green-500",
      bg: "bg-green-500/10",
      value: (
        <span>
          {completedChallenges}/{weeklyChallenges.length}{" "}
          <span className="text-sm font-normal text-muted-foreground">challenges</span>
        </span>
      ),
      sub: `${game.weeklyXp} XP this week`,
    },
  ];

  return (
    <Link href="/achievements" className="block">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {widgets.map((w, i) => (
          <motion.div
            key={w.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ y: -2 }}
          >
            <Card className="h-full hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", w.bg)}>
                    <w.icon className={cn("w-4 h-4", w.color)} />
                  </div>
                </div>
                <div className="text-xl font-bold truncate">{w.value}</div>
                {typeof w.bar === "number" && (
                  <div className="h-1.5 bg-muted rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all"
                      style={{ width: `${w.bar}%` }}
                    />
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-1 truncate">{w.sub}</div>
                <div className="text-[11px] text-muted-foreground/70 mt-0.5">{w.label}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </Link>
  );
}

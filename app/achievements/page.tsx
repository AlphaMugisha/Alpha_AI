"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { motion } from "framer-motion";
import { useGamification } from "@/context/GamificationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Trophy,
  Flame,
  Star,
  Zap,
  Target,
  Plus,
  Check,
  Trash2,
  Sparkles,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { achievementProgress, achievementProgressLabel } from "@/lib/gamification/rules";
import { Rarity, Achievement } from "@/lib/gamification/types";

const RARITY_RING: Record<Rarity, string> = {
  common: "from-slate-400 to-slate-500",
  rare: "from-blue-500 to-cyan-500",
  epic: "from-violet-500 to-fuchsia-500",
  legendary: "from-amber-400 to-orange-500",
};
const RARITY_TEXT: Record<Rarity, string> = {
  common: "text-slate-500",
  rare: "text-blue-500",
  epic: "text-violet-500",
  legendary: "text-amber-500",
};

export default function AchievementsPage() {
  return (
    <DashboardLayout>
      <AchievementsContent />
    </DashboardLayout>
  );
}

function AchievementsContent() {
  const {
    game,
    weeklyChallenges,
    dailyGoals,
    loading,
    generateDailyGoals,
    removeGoal,
  } = useGamification();
  const [generating, setGenerating] = useState(false);

  if (loading && !game) {
    return (
      <>
        <PageHeader title="Progress" icon={<Trophy className="w-5 h-5" />} />
        <div className="h-40 bg-muted rounded-2xl animate-pulse mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </>
    );
  }
  if (!game) {
    return (
      <>
        <PageHeader title="Progress" icon={<Trophy className="w-5 h-5" />} />
        <p className="text-sm text-muted-foreground">Start studying to earn XP and unlock achievements.</p>
      </>
    );
  }

  const unlockedKeys = game.unlockedKeys;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateDailyGoals();
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Progress & Achievements"
        description="Track your XP, streaks, goals, and unlocked achievements."
        icon={<Trophy className="w-5 h-5" />}
      />

      {/* Hero: level + XP + streak */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-7 text-white overflow-hidden mb-6"
      >
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6 justify-between">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-white/15 backdrop-blur flex flex-col items-center justify-center shrink-0">
              <span className="text-[10px] uppercase tracking-widest text-violet-100">Level</span>
              <span className="text-3xl font-extrabold leading-none">{game.level}</span>
            </div>
            <div>
              <div className="flex items-center gap-2 text-violet-100 text-sm">
                <Zap className="w-4 h-4" /> {game.totalXp.toLocaleString()} total XP
              </div>
              <div className="mt-2 w-56 max-w-full">
                <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${game.pct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full bg-white rounded-full"
                  />
                </div>
                <p className="text-xs text-violet-100 mt-1">
                  {game.isMax
                    ? "Max level reached"
                    : `${game.xpIntoLevel} / ${game.xpForNextLevel} XP — ${game.xpToNext} to Level ${game.level + 1}`}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="text-center px-4 py-2 rounded-xl bg-white/10">
              <div className="flex items-center justify-center gap-1 text-2xl font-bold">
                <Flame className="w-5 h-5 text-orange-300" /> {game.streak.currentStreak}
              </div>
              <div className="text-[11px] text-violet-100 uppercase tracking-wide">Day streak</div>
            </div>
            <div className="text-center px-4 py-2 rounded-xl bg-white/10">
              <div className="flex items-center justify-center gap-1 text-2xl font-bold">
                <Trophy className="w-5 h-5 text-amber-300" /> {game.unlocked.length}
              </div>
              <div className="text-[11px] text-violet-100 uppercase tracking-wide">Unlocked</div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Weekly challenges */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4 text-green-500" /> Weekly Challenges
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {weeklyChallenges.map((c) => {
              const pct = Math.min(100, Math.round((c.progress / c.target) * 100));
              return (
                <div key={c.key}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium flex items-center gap-2">
                      <span>{c.icon}</span> {c.title}
                    </span>
                    {c.completed ? (
                      <Badge className="bg-green-500/15 text-green-600 dark:text-green-400 hover:bg-green-500/15 text-[10px]">
                        <Check className="w-3 h-3 mr-0.5" /> Done
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {Math.min(c.progress, c.target)}/{c.target}
                      </span>
                    )}
                  </div>
                  <Progress value={pct} className="h-2" />
                  <div className="text-[11px] text-muted-foreground mt-1">+{c.xpReward} XP</div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Daily goals */}
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-500" /> Today&apos;s Goals
            </CardTitle>
            {dailyGoals.length === 0 && (
              <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generating}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Generate
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {dailyGoals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No goals yet. Generate a set of daily goals to earn bonus XP.
              </p>
            ) : (
              dailyGoals.map((g) => {
                const pct = Math.min(100, Math.round((g.progress / g.target) * 100));
                return (
                  <div key={g.id} className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2",
                        g.completed
                          ? "bg-green-500 border-green-500"
                          : "border-muted-foreground/30"
                      )}
                    >
                      {g.completed && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={cn("text-sm font-medium", g.completed && "line-through text-muted-foreground")}>
                        {g.title}
                      </div>
                      <Progress value={pct} className="h-1.5 mt-1" />
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">+{g.xpReward}</span>
                    <button
                      onClick={() => removeGoal(g.id)}
                      className="p-1 rounded hover:text-destructive text-muted-foreground shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Achievements showcase */}
      <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
        <Star className="w-5 h-5 text-amber-500" /> Achievements
      </h3>
      {(["beginner", "intermediate", "advanced"] as const).map((category) => {
        const items = game.achievements.filter((a) => a.category === category);
        if (items.length === 0) return null;
        return (
          <div key={category} className="mb-6">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 capitalize">
              {category}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((a) => (
                <AchievementCard
                  key={a.key}
                  achievement={a}
                  unlocked={unlockedKeys.has(a.key)}
                  progress={achievementProgress(a.key, game.stats)}
                  progressLabel={achievementProgressLabel(a.key, game.stats)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

function AchievementCard({
  achievement: a,
  unlocked,
  progress,
  progressLabel,
}: {
  achievement: Achievement;
  unlocked: boolean;
  progress: number;
  progressLabel: string;
}) {
  return (
    <motion.div whileHover={{ y: -2 }}>
      <Card className={cn("h-full transition-shadow", unlocked ? "hover:shadow-md" : "opacity-80")}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 relative",
                unlocked
                  ? `bg-gradient-to-br ${RARITY_RING[a.rarity]} shadow`
                  : "bg-muted grayscale"
              )}
            >
              {unlocked ? a.icon : <Lock className="w-5 h-5 text-muted-foreground" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm truncate">{a.name}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.description}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={cn("text-[10px] font-semibold uppercase tracking-wide", RARITY_TEXT[a.rarity])}>
                  {a.rarity}
                </span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <Zap className="w-3 h-3" />+{a.xpReward} XP
                </span>
              </div>
            </div>
          </div>
          {!unlocked && progress > 0 && progress < 1 && (
            <div className="mt-3">
              <Progress value={Math.round(progress * 100)} className="h-1.5" />
              {progressLabel && (
                <p className="text-[11px] text-muted-foreground mt-1">{progressLabel}</p>
              )}
            </div>
          )}
          {unlocked && (
            <div className="mt-2 text-[11px] text-green-600 dark:text-green-400 flex items-center gap-1">
              <Check className="w-3 h-3" /> Unlocked
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

"use client";

/**
 * Gamification data access (client-side Supabase, RLS owner-only).
 */

import { createClient } from "@/lib/supabase/client";
import { sessionDb, quizDb } from "@/lib/db";
import { StudySession, QuizResult } from "@/types";
import {
  Achievement,
  UnlockedAchievement,
  StreakState,
  GameStats,
  DailyGoal,
} from "./types";
import { levelForXp } from "./levels";

function sb() {
  return createClient();
}

async function uid(): Promise<string | null> {
  const { data } = await sb().auth.getUser();
  return data.user?.id ?? null;
}

// ----------------------------- mappers -----------------------------
/* eslint-disable @typescript-eslint/no-explicit-any */
function toAchievement(r: any): Achievement {
  return {
    id: r.id,
    key: r.key,
    name: r.name,
    description: r.description,
    icon: r.icon,
    rarity: r.rarity,
    category: r.category,
    xpReward: r.xp_reward,
    sortOrder: r.sort_order,
  };
}

function toDailyGoal(r: any): DailyGoal {
  return {
    id: r.id,
    goalDate: r.goal_date,
    title: r.title,
    metric: r.metric,
    target: r.target,
    progress: 0,
    completed: r.completed,
    xpReward: r.xp_reward,
  };
}

// ----------------------------- reads -----------------------------
export async function getProfileXp(): Promise<{ totalXp: number; level: number }> {
  const { data } = await sb()
    .from("profiles")
    .select("total_xp, current_level")
    .maybeSingle();
  return { totalXp: data?.total_xp ?? 0, level: data?.current_level ?? 1 };
}

export async function getStreak(): Promise<StreakState> {
  const { data } = await sb()
    .from("streaks")
    .select("current_streak, longest_streak, last_activity_date")
    .maybeSingle();
  return {
    currentStreak: data?.current_streak ?? 0,
    longestStreak: data?.longest_streak ?? 0,
    lastActivityDate: data?.last_activity_date ?? null,
  };
}

export async function getCatalog(): Promise<Achievement[]> {
  const { data } = await sb()
    .from("achievements")
    .select("*")
    .order("sort_order", { ascending: true });
  return (data ?? []).map(toAchievement);
}

export async function getUnlocked(catalog: Achievement[]): Promise<UnlockedAchievement[]> {
  const byId = new Map(catalog.map((a) => [a.id, a]));
  const { data } = await sb()
    .from("user_achievements")
    .select("achievement_id, unlocked_at")
    .order("unlocked_at", { ascending: false });
  const out: UnlockedAchievement[] = [];
  for (const r of data ?? []) {
    const a = byId.get(r.achievement_id);
    if (a) out.push({ ...a, unlockedAt: new Date(r.unlocked_at) });
  }
  return out;
}

export async function getWeeklyXp(weekStartISO: string): Promise<number> {
  const { data } = await sb()
    .from("xp_log")
    .select("amount")
    .gte("created_at", weekStartISO);
  return (data ?? []).reduce((sum: number, r: any) => sum + (r.amount ?? 0), 0);
}

export async function getDailyGoals(dateKey: string): Promise<DailyGoal[]> {
  const { data } = await sb()
    .from("daily_goals")
    .select("*")
    .eq("goal_date", dateKey)
    .order("created_at", { ascending: true });
  return (data ?? []).map(toDailyGoal);
}

// ----------------------------- writes -----------------------------
export async function updateProfileXp(totalXp: number, level: number): Promise<void> {
  const id = await uid();
  if (!id) return;
  await sb().from("profiles").update({ total_xp: totalXp, current_level: level }).eq("id", id);
}

export async function upsertStreak(s: StreakState): Promise<void> {
  await sb().from("streaks").upsert(
    {
      current_streak: s.currentStreak,
      longest_streak: s.longestStreak,
      last_activity_date: s.lastActivityDate,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}

export async function logXp(amount: number, reason: string): Promise<void> {
  await sb().from("xp_log").insert({ amount, reason });
}

export async function unlockAchievement(achievementId: string): Promise<void> {
  await sb()
    .from("user_achievements")
    .upsert({ achievement_id: achievementId }, { onConflict: "user_id,achievement_id", ignoreDuplicates: true });
}

/** Returns true if this reward was newly claimed (false = already claimed). */
export async function claimReward(rewardKey: string): Promise<boolean> {
  const { data, error } = await sb()
    .from("claimed_rewards")
    .upsert({ reward_key: rewardKey }, { onConflict: "user_id,reward_key", ignoreDuplicates: true })
    .select();
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

export async function createDailyGoal(goal: {
  title: string;
  metric: DailyGoal["metric"];
  target: number;
  dateKey: string;
  xpReward?: number;
}): Promise<void> {
  await sb().from("daily_goals").insert({
    title: goal.title,
    metric: goal.metric,
    target: goal.target,
    goal_date: goal.dateKey,
    xp_reward: goal.xpReward ?? 50,
  });
}

export async function markGoalCompleted(id: string): Promise<void> {
  const gid = await uid();
  if (!gid) return;
  await sb().from("daily_goals").update({ completed: true }).eq("id", id);
}

export async function deleteDailyGoal(id: string): Promise<void> {
  await sb().from("daily_goals").delete().eq("id", id);
}

// ----------------------------- stats -----------------------------
export function computeGameStats(
  sessions: StudySession[],
  quizResults: QuizResult[],
  totalXp: number,
  streak: StreakState
): GameStats {
  const sessionsByType: GameStats["sessionsByType"] = {
    chat: 0,
    notes: 0,
    quiz: 0,
    flashcards: 0,
    explain: 0,
    planner: 0,
  };
  let totalStudyMinutes = 0;
  for (const s of sessions) {
    if (sessionsByType[s.type] !== undefined) sessionsByType[s.type]++;
    totalStudyMinutes += s.duration ?? 0;
  }

  let pass90 = 0;
  let accSum = 0;
  for (const r of quizResults) {
    const acc = r.totalQuestions > 0 ? (r.score / r.totalQuestions) * 100 : 0;
    if (acc >= 90) pass90++;
    accSum += acc;
  }

  return {
    totalSessions: sessions.length,
    sessionsByType,
    totalStudyMinutes,
    quizCount: quizResults.length,
    quizPass90Count: pass90,
    averageAccuracy: quizResults.length ? Math.round(accSum / quizResults.length) : 0,
    level: levelForXp(totalXp),
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
  };
}

/** Loads the raw session + quiz data the engine and stats need. */
export async function loadActivityData(): Promise<{
  sessions: StudySession[];
  quizResults: QuizResult[];
}> {
  const [sessions, quizResults] = await Promise.all([
    sessionDb.getAll(),
    quizDb.getResults(),
  ]);
  return { sessions, quizResults };
}

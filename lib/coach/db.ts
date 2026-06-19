"use client";

/**
 * Data access for the AI Study Coach.
 *
 * - `loadCoachData` pulls every real signal the coach reasons about.
 * - `coachStateDb` caches the AI-generated narrative so we only call the model
 *   once per day (daily) / week (weekly) unless the user forces a refresh.
 */

import { createClient } from "@/lib/supabase/client";
import {
  sessionDb,
  quizDb,
  flashcardDb,
  taskDb,
  coursesDb,
} from "@/lib/db";
import { RawCoachData, GoalRow } from "./analytics";
import { loadGameState } from "@/lib/gamification/engine";
import { achievementProgress, achievementProgressLabel } from "@/lib/gamification/rules";
import { CoachGame } from "./types";

async function loadGame(): Promise<CoachGame | null> {
  try {
    const g = await loadGameState();
    // Closest locked achievement (highest progress, not yet complete).
    let next: CoachGame["nextAchievement"] = null;
    let bestProgress = -1;
    for (const a of g.achievements) {
      if (g.unlockedKeys.has(a.key)) continue;
      const p = achievementProgress(a.key, g.stats);
      if (p > bestProgress && p < 1) {
        bestProgress = p;
        next = { name: a.name, label: achievementProgressLabel(a.key, g.stats) || a.description };
      }
    }
    return {
      level: g.level,
      xpToNext: g.xpToNext,
      nextLevel: g.level + 1,
      isMax: g.isMax,
      totalXp: g.totalXp,
      currentStreak: g.streak.currentStreak,
      longestStreak: g.streak.longestStreak,
      nextAchievement: next,
    };
  } catch {
    return null;
  }
}

async function loadGoals(): Promise<GoalRow[]> {
  const { data, error } = await createClient()
    .from("study_goals")
    .select("title, target_date");
  if (error) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    title: r.title,
    targetDate: r.target_date ?? null,
  }));
}

export async function loadCoachData(firstName: string | null): Promise<RawCoachData> {
  const [sessions, quizzes, quizResults, tasks, decks, courses, goals, game] =
    await Promise.all([
      sessionDb.getAll(),
      quizDb.getAll(),
      quizDb.getResults(),
      taskDb.getAll(),
      flashcardDb.getAll(),
      coursesDb.getAll(),
      loadGoals(),
      loadGame(),
    ]);
  return { firstName, sessions, quizzes, quizResults, tasks, decks, courses, goals, game };
}

/** Local YYYY-MM-DD (matches a Postgres `date`, no timezone surprises). */
export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday of the current week, as a date key. */
export function weekKey(d = new Date()): string {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7; // 0 = Monday
  x.setDate(x.getDate() - dow);
  return todayKey(x);
}

export const coachStateDb = {
  async get<T>(kind: "daily" | "weekly", refDate: string): Promise<T | null> {
    const { data, error } = await createClient()
      .from("coach_state")
      .select("payload")
      .eq("kind", kind)
      .eq("ref_date", refDate)
      .maybeSingle();
    if (error || !data) return null;
    return data.payload as T;
  },
  async save(kind: "daily" | "weekly", refDate: string, payload: unknown): Promise<void> {
    const { error } = await createClient()
      .from("coach_state")
      .upsert(
        { kind, ref_date: refDate, payload },
        { onConflict: "user_id,kind,ref_date" }
      );
    if (error) throw error;
  },
};

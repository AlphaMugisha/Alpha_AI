"use client";

/**
 * Gamification engine: the single pipeline that turns a completed activity
 * into XP, streak progress, level-ups, and achievement unlocks. Returns
 * `RewardEvents` so the UI can play celebration animations.
 *
 * Everything is grounded in real stored activity; grants are made idempotent
 * via the `claimed_rewards` table so XP is never double-counted.
 */

import { StudySession, QuizResult } from "@/types";
import {
  RewardEvents,
  GameState,
  WeeklyChallenge,
  DailyGoal,
} from "./types";
import { levelForXp, levelProgress } from "./levels";
import {
  XP_RULES,
  XP_QUIZ_HIGH_SCORE_BONUS,
  XP_STREAK_DAILY_BONUS,
  ACHIEVEMENT_CRITERIA,
  WEEKLY_CHALLENGE_DEFS,
} from "./rules";
import {
  getProfileXp,
  getStreak,
  getCatalog,
  getUnlocked,
  getWeeklyXp,
  getDailyGoals,
  loadActivityData,
  computeGameStats,
  updateProfileXp,
  upsertStreak,
  logXp,
  unlockAchievement,
  claimReward,
  markGoalCompleted,
} from "./db";

// ----------------------------- date helpers -----------------------------
const DAY = 24 * 60 * 60 * 1000;

export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function weekStart(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - dow);
  return x;
}

function sameDay(d: Date, key: string): boolean {
  return todayKey(d) === key;
}

// ----------------------------- progress counters -----------------------------
type Metric = DailyGoal["metric"];

function countMetric(
  sessions: StudySession[],
  quizResults: QuizResult[],
  metric: Metric,
  since: number,
  dayKey?: string
): number {
  const inWindow = (d: Date) =>
    dayKey ? sameDay(d, dayKey) : d.getTime() >= since;

  if (metric === "quiz") {
    // Count actual quiz completions (results), not generations.
    return quizResults.filter((r) => inWindow(r.completedAt)).length;
  }
  if (metric === "minutes") {
    return sessions
      .filter((s) => inWindow(s.createdAt))
      .reduce((sum, s) => sum + (s.duration ?? 0), 0);
  }
  if (metric === "any" || metric === "session") {
    return sessions.filter((s) => inWindow(s.createdAt)).length;
  }
  const type = metric as StudySession["type"];
  return sessions.filter((s) => s.type === type && inWindow(s.createdAt)).length;
}

export function computeWeeklyChallenges(
  sessions: StudySession[],
  quizResults: QuizResult[]
): WeeklyChallenge[] {
  const since = weekStart().getTime();
  return WEEKLY_CHALLENGE_DEFS.map((def) => {
    const progress = countMetric(sessions, quizResults, def.metric, since);
    return { ...def, progress, completed: progress >= def.target };
  });
}

export function withGoalProgress(
  goals: DailyGoal[],
  sessions: StudySession[],
  quizResults: QuizResult[],
  dayKey: string
): DailyGoal[] {
  return goals.map((g) => {
    const progress = countMetric(sessions, quizResults, g.metric, 0, dayKey);
    return { ...g, progress, completed: g.completed || progress >= g.target };
  });
}

// ----------------------------- record activity -----------------------------
export async function recordActivity(
  type: StudySession["type"],
  ctx?: { score?: number }
): Promise<RewardEvents> {
  const events: RewardEvents = {
    xpGained: 0,
    reasons: [],
    leveledUp: false,
    newLevel: null,
    unlocked: [],
  };

  const [profileXp, streak, activity, catalog] = await Promise.all([
    getProfileXp(),
    getStreak(),
    loadActivityData(),
    getCatalog(),
  ]);
  const unlockedList = await getUnlocked(catalog);
  const unlockedKeys = new Set(unlockedList.map((a) => a.key));

  let totalXp = profileXp.totalXp;
  const oldLevel = levelForXp(totalXp);

  const add = (amount: number, reason: string) => {
    if (amount <= 0) return;
    totalXp += amount;
    events.xpGained += amount;
    events.reasons.push(reason);
    logXp(amount, reason).catch(() => {});
  };

  // 1. Base activity XP (+ quiz high-score bonus).
  add(XP_RULES[type] ?? 0, `activity:${type}`);
  if (type === "quiz" && (ctx?.score ?? 0) >= 80) {
    add(XP_QUIZ_HIGH_SCORE_BONUS, "quiz high score bonus");
  }

  // 2. Streak (counts once per calendar day) + daily bonus.
  const today = todayKey();
  if (streak.lastActivityDate !== today) {
    const yesterday = todayKey(new Date(Date.now() - DAY));
    streak.currentStreak =
      streak.lastActivityDate === yesterday ? streak.currentStreak + 1 : 1;
    streak.longestStreak = Math.max(streak.longestStreak, streak.currentStreak);
    streak.lastActivityDate = today;
    if (await claimReward(`streak-${today}`)) {
      add(XP_STREAK_DAILY_BONUS, "daily streak bonus");
    }
    await upsertStreak(streak);
  }

  // 3. Achievements (re-evaluate against fresh stats).
  const stats = computeGameStats(activity.sessions, activity.quizResults, totalXp, streak);
  for (const a of catalog) {
    if (unlockedKeys.has(a.key)) continue;
    const crit = ACHIEVEMENT_CRITERIA[a.key];
    if (crit && crit(stats)) {
      await unlockAchievement(a.id);
      unlockedKeys.add(a.key);
      events.unlocked.push(a);
      add(a.xpReward, `achievement:${a.key}`);
      stats.level = levelForXp(totalXp); // chain level-based unlocks
    }
  }

  // 4. Daily goals.
  const goals = await getDailyGoals(today);
  for (const g of withGoalProgress(goals, activity.sessions, activity.quizResults, today)) {
    if (g.completed && !goals.find((x) => x.id === g.id)?.completed) {
      await markGoalCompleted(g.id);
      if (await claimReward(`goal-${g.id}`)) add(g.xpReward, `daily goal: ${g.title}`);
    }
  }

  // 5. Weekly challenges.
  const wkKey = todayKey(weekStart());
  for (const c of computeWeeklyChallenges(activity.sessions, activity.quizResults)) {
    if (c.completed && (await claimReward(`weekly-${wkKey}-${c.key}`))) {
      add(c.xpReward, `weekly challenge: ${c.title}`);
    }
  }

  // 6. Persist final XP + level.
  const newLevel = levelForXp(totalXp);
  if (newLevel > oldLevel) {
    events.leveledUp = true;
    events.newLevel = newLevel;
  }
  await updateProfileXp(totalXp, newLevel);

  return events;
}

// ----------------------------- load full state -----------------------------
export async function loadGameState(): Promise<GameState> {
  const [profileXp, streak, catalog, activity] = await Promise.all([
    getProfileXp(),
    getStreak(),
    getCatalog(),
    loadActivityData(),
  ]);
  const unlocked = await getUnlocked(catalog);
  const weeklyXp = await getWeeklyXp(weekStart().toISOString());

  const stats = computeGameStats(
    activity.sessions,
    activity.quizResults,
    profileXp.totalXp,
    streak
  );
  const prog = levelProgress(profileXp.totalXp);

  return {
    totalXp: profileXp.totalXp,
    level: prog.level,
    xpIntoLevel: prog.xpIntoLevel,
    xpForNextLevel: prog.xpForNextLevel,
    xpToNext: prog.xpToNext,
    pct: prog.pct,
    isMax: prog.isMax,
    streak,
    weeklyXp,
    achievements: catalog,
    unlocked,
    unlockedKeys: new Set(unlocked.map((a) => a.key)),
    recentAchievement: unlocked[0] ?? null,
    stats,
  };
}

export async function loadWeeklyChallenges(): Promise<WeeklyChallenge[]> {
  const activity = await loadActivityData();
  return computeWeeklyChallenges(activity.sessions, activity.quizResults);
}

export async function loadDailyGoals(): Promise<DailyGoal[]> {
  const today = todayKey();
  const [goals, activity] = await Promise.all([getDailyGoals(today), loadActivityData()]);
  return withGoalProgress(goals, activity.sessions, activity.quizResults, today);
}

import { StudySession } from "@/types";
import { GameStats, WeeklyChallenge } from "./types";

/** Base XP per activity type. */
export const XP_RULES: Record<StudySession["type"], number> = {
  notes: 10,
  quiz: 25,
  flashcards: 15,
  explain: 10,
  chat: 5,
  planner: 20, // completing a study-plan task / planning
};

export const XP_QUIZ_HIGH_SCORE_BONUS = 15; // score >= 80%
export const XP_STREAK_DAILY_BONUS = 10;
export const XP_DAILY_GOAL = 50;
export const XP_WEEKLY_CHALLENGE = 100;

/** Achievement criteria keyed by achievement `key`. Pure over GameStats. */
export const ACHIEVEMENT_CRITERIA: Record<string, (s: GameStats) => boolean> = {
  first_session: (s) => s.totalSessions >= 1,
  quiz_rookie: (s) => s.quizCount >= 1,
  note_taker: (s) => s.sessionsByType.notes >= 1,
  streak_7: (s) => s.longestStreak >= 7,
  level_5: (s) => s.level >= 5,
  quiz_master: (s) => s.quizPass90Count >= 10,
  study_enthusiast: (s) => s.totalStudyMinutes >= 25 * 60,
  flashcard_fan: (s) => s.sessionsByType.flashcards >= 10,
  streak_30: (s) => s.longestStreak >= 30,
  level_10: (s) => s.level >= 10,
  study_legend: (s) => s.level >= 25,
  consistency_king: (s) => s.longestStreak >= 100,
  exam_destroyer: (s) => s.quizCount >= 20 && s.averageAccuracy >= 95,
};

/**
 * Progress (0-1) toward an achievement, for the locked-achievement progress
 * bars and the AI Coach's "X away from unlocking" nudges.
 */
export function achievementProgress(key: string, s: GameStats): number {
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  switch (key) {
    case "first_session":
      return clamp(s.totalSessions / 1);
    case "quiz_rookie":
      return clamp(s.quizCount / 1);
    case "note_taker":
      return clamp(s.sessionsByType.notes / 1);
    case "streak_7":
      return clamp(s.longestStreak / 7);
    case "level_5":
      return clamp(s.level / 5);
    case "quiz_master":
      return clamp(s.quizPass90Count / 10);
    case "study_enthusiast":
      return clamp(s.totalStudyMinutes / (25 * 60));
    case "flashcard_fan":
      return clamp(s.sessionsByType.flashcards / 10);
    case "streak_30":
      return clamp(s.longestStreak / 30);
    case "level_10":
      return clamp(s.level / 10);
    case "study_legend":
      return clamp(s.level / 25);
    case "consistency_king":
      return clamp(s.longestStreak / 100);
    case "exam_destroyer":
      return clamp((s.quizCount / 20 + s.averageAccuracy / 95) / 2);
    default:
      return 0;
  }
}

/** Human-readable progress label, e.g. "7/10 quizzes". */
export function achievementProgressLabel(key: string, s: GameStats): string {
  switch (key) {
    case "quiz_master":
      return `${Math.min(s.quizPass90Count, 10)}/10 quizzes at 90%+`;
    case "study_enthusiast":
      return `${(s.totalStudyMinutes / 60).toFixed(1)}/25 hours`;
    case "flashcard_fan":
      return `${Math.min(s.sessionsByType.flashcards, 10)}/10 sessions`;
    case "streak_7":
      return `${Math.min(s.longestStreak, 7)}/7 days`;
    case "streak_30":
      return `${Math.min(s.longestStreak, 30)}/30 days`;
    case "consistency_king":
      return `${Math.min(s.longestStreak, 100)}/100 days`;
    case "level_5":
    case "level_10":
    case "study_legend": {
      const target = key === "level_5" ? 5 : key === "level_10" ? 10 : 25;
      return `Level ${s.level}/${target}`;
    }
    case "exam_destroyer":
      return `${s.averageAccuracy}% avg over ${s.quizCount}/20 quizzes`;
    default:
      return "";
  }
}

/** Weekly challenge definitions; progress is filled in from live activity. */
export const WEEKLY_CHALLENGE_DEFS: Omit<WeeklyChallenge, "progress" | "completed">[] = [
  { key: "quizzes_10", title: "Complete 10 quizzes", icon: "🧠", metric: "quiz", target: 10, xpReward: 100 },
  { key: "flashcards_5", title: "Study flashcards 5 times", icon: "🃏", metric: "flashcards", target: 5, xpReward: 80 },
  { key: "notes_5", title: "Generate 5 sets of notes", icon: "📝", metric: "notes", target: 5, xpReward: 80 },
  { key: "minutes_120", title: "Study 2 hours this week", icon: "⏱️", metric: "minutes", target: 120, xpReward: 120 },
  { key: "sessions_15", title: "Log 15 study activities", icon: "📈", metric: "session", target: 15, xpReward: 120 },
];

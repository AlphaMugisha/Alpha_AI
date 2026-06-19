import { StudySession } from "@/types";

export type Rarity = "common" | "rare" | "epic" | "legendary";
export type AchievementCategory = "beginner" | "intermediate" | "advanced";

export interface Achievement {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  rarity: Rarity;
  category: AchievementCategory;
  xpReward: number;
  sortOrder: number;
}

export interface UnlockedAchievement extends Achievement {
  unlockedAt: Date;
}

/** Aggregate facts used to evaluate achievement criteria. */
export interface GameStats {
  totalSessions: number;
  sessionsByType: Record<StudySession["type"], number>;
  totalStudyMinutes: number;
  quizCount: number;
  quizPass90Count: number; // quizzes scored >= 90%
  averageAccuracy: number; // 0-100
  level: number;
  currentStreak: number;
  longestStreak: number;
}

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
}

export interface DailyGoal {
  id: string;
  goalDate: string;
  title: string;
  metric: "quiz" | "flashcards" | "notes" | "session" | "minutes" | "any";
  target: number;
  progress: number; // computed live
  completed: boolean;
  xpReward: number;
}

export interface WeeklyChallenge {
  key: string;
  title: string;
  icon: string;
  metric: "quiz" | "flashcards" | "notes" | "session" | "minutes";
  target: number;
  progress: number;
  completed: boolean;
  xpReward: number;
}

/** Events produced by recording an activity, consumed by reward animations. */
export interface RewardEvents {
  xpGained: number;
  reasons: string[];
  leveledUp: boolean;
  newLevel: number | null;
  unlocked: Achievement[];
}

export interface GameState {
  totalXp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  xpToNext: number;
  pct: number;
  isMax: boolean;
  streak: StreakState;
  weeklyXp: number;
  achievements: Achievement[]; // full catalog
  unlocked: UnlockedAchievement[];
  unlockedKeys: Set<string>;
  recentAchievement: UnlockedAchievement | null;
  stats: GameStats;
}

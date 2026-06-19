/**
 * Types for the AI Study Coach.
 *
 * A `CoachSnapshot` is a deterministic, fact-only summary computed from the
 * user's real stored data (study sessions, quiz results, tasks, flashcards,
 * goals). The AI layer turns this snapshot into natural-language coaching but
 * is never allowed to invent numbers or subjects — everything it says is
 * grounded in the snapshot.
 */

export interface SubjectStat {
  subject: string;
  /** Average quiz accuracy 0-100, or null when the subject has no quiz attempts. */
  accuracy: number | null;
  attempts: number;
  /** Days since this subject was last touched (quiz/revision), or null if never. */
  daysSinceReview: number | null;
  /** Pending (incomplete) tasks tagged to this subject. */
  pendingTasks: number;
}

export interface DeadlineItem {
  title: string;
  subject?: string;
  /** ISO date string. */
  date: string;
  daysRemaining: number;
  kind: "task" | "goal" | "exam";
  priority?: "low" | "medium" | "high";
}

export interface StaleDeck {
  title: string;
  daysSinceStudied: number | null;
  cardCount: number;
}

export interface CoachGame {
  level: number;
  xpToNext: number;
  nextLevel: number;
  isMax: boolean;
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  /** The locked achievement the student is closest to unlocking. */
  nextAchievement: { name: string; label: string } | null;
}

export interface CoachSnapshot {
  firstName: string | null;
  generatedAt: string;
  game: CoachGame | null;

  // Activity
  activitiesThisWeek: number;
  activitiesLastWeek: number;
  studyMinutesThisWeek: number;
  streakDays: number;
  studiedToday: boolean;

  // Quizzes
  totalQuizAttempts: number;
  averageAccuracy: number | null;
  accuracyTrend: number | null; // this week vs last week, percentage points

  // Subjects
  subjects: SubjectStat[];
  weakestSubject: SubjectStat | null;
  strongestSubject: SubjectStat | null;
  mostImprovedSubject: { subject: string; delta: number } | null;
  staleSubjects: SubjectStat[]; // not reviewed in a while

  // Tasks & deadlines
  pendingTasks: number;
  missedTasks: number;
  completedTasksThisWeek: number;
  upcomingDeadlines: DeadlineItem[];
  nextExam: DeadlineItem | null;
  examMode: boolean;

  // Flashcards
  staleDecks: StaleDeck[];

  /** True when there's barely any data to reason about yet. */
  sparse: boolean;
}

// ----- AI narrative payloads (cached in coach_state) -----

export interface CoachRecommendation {
  title: string;
  reason: string;
  /** One of the quick actions. */
  action: "plan" | "explain" | "quiz" | "revise" | "task";
  subject?: string;
}

export interface CoachInsight {
  text: string;
  tone: "positive" | "neutral" | "warning";
}

export interface DailyCoaching {
  greeting: string;
  headline: string;
  prioritySubject: string | null;
  recommendation: string;
  motivation: string;
  recommendations: CoachRecommendation[];
  insights: CoachInsight[];
}

export interface WeeklyReport {
  summary: string;
  totalHours: string;
  quizPerformance: string;
  bestSubject: string;
  weakestSubject: string;
  mostImproved: string;
  nextWeek: string[];
}

export interface PlanBlock {
  subject: string;
  minutes: number;
  focus: string;
}

export interface PlanDay {
  day: string;
  blocks: PlanBlock[];
}

export interface SmartPlan {
  title: string;
  rationale: string;
  days: PlanDay[];
}

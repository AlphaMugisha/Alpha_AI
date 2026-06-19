/**
 * Deterministic analytics for the AI Study Coach.
 *
 * `computeSnapshot` turns the user's raw stored data into a fact-only
 * `CoachSnapshot`. There is NO AI here and NO randomness — every number is
 * derived from real rows. The AI layer later phrases these facts; it never
 * invents them.
 */

import {
  StudySession,
  Quiz,
  QuizResult,
  StudyTask,
  FlashcardDeck,
  Course,
} from "@/types";
import {
  CoachSnapshot,
  CoachGame,
  SubjectStat,
  DeadlineItem,
  StaleDeck,
} from "./types";

export interface GoalRow {
  title: string;
  targetDate: string | null;
}

export interface RawCoachData {
  firstName: string | null;
  sessions: StudySession[];
  quizzes: Quiz[];
  quizResults: QuizResult[];
  tasks: StudyTask[];
  decks: FlashcardDeck[];
  goals: GoalRow[];
  courses: Course[];
  game?: CoachGame | null;
}

const DAY = 24 * 60 * 60 * 1000;

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / DAY);
}

function startOfDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(quiz|exam|test|deck|notes?|flashcards?|revision)\b/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function computeSnapshot(data: RawCoachData): CoachSnapshot {
  const now = new Date();
  const weekAgo = now.getTime() - 7 * DAY;
  const twoWeeksAgo = now.getTime() - 14 * DAY;

  // ---- Activity ----
  const sessionsThisWeek = data.sessions.filter(
    (s) => s.createdAt.getTime() >= weekAgo
  );
  const sessionsLastWeek = data.sessions.filter(
    (s) =>
      s.createdAt.getTime() < weekAgo && s.createdAt.getTime() >= twoWeeksAgo
  );
  const studyMinutesThisWeek = sessionsThisWeek.reduce(
    (sum, s) => sum + (s.duration ?? 0),
    0
  );

  // ---- Streak: consecutive days (ending today or yesterday) with activity ----
  const activeDays = new Set(
    data.sessions.map((s) => startOfDay(s.createdAt))
  );
  const today0 = startOfDay(now);
  let streakDays = 0;
  // allow the streak to "hold" if they studied today OR yesterday
  let cursor = activeDays.has(today0) ? today0 : today0 - DAY;
  while (activeDays.has(cursor)) {
    streakDays++;
    cursor -= DAY;
  }
  const studiedToday = activeDays.has(today0);

  // ---- Quiz performance, grouped by subject (quiz title) ----
  const quizTitleById = new Map(data.quizzes.map((q) => [q.id, q.title]));

  interface Agg {
    display: string;
    accSum: number;
    attempts: number;
    lastAttempt: number | null;
    recentAccSum: number;
    recentN: number;
    olderAccSum: number;
    olderN: number;
  }
  const subjectMap = new Map<string, Agg>();

  function ensure(key: string, display: string): Agg {
    let a = subjectMap.get(key);
    if (!a) {
      a = {
        display,
        accSum: 0,
        attempts: 0,
        lastAttempt: null,
        recentAccSum: 0,
        recentN: 0,
        olderAccSum: 0,
        olderN: 0,
      };
      subjectMap.set(key, a);
    }
    return a;
  }

  for (const r of data.quizResults) {
    const rawTitle = (r.quizId && quizTitleById.get(r.quizId)) || "General";
    const key = norm(rawTitle) || "general";
    const display = titleCase(norm(rawTitle) || rawTitle) || "General";
    const a = ensure(key, display);
    const acc =
      r.totalQuestions > 0 ? (r.score / r.totalQuestions) * 100 : 0;
    const ts = r.completedAt.getTime();
    a.accSum += acc;
    a.attempts += 1;
    a.lastAttempt = a.lastAttempt ? Math.max(a.lastAttempt, ts) : ts;
    if (ts >= weekAgo) {
      a.recentAccSum += acc;
      a.recentN += 1;
    } else {
      a.olderAccSum += acc;
      a.olderN += 1;
    }
  }

  // Pending tasks + last-touch per subject (from tasks and study sessions).
  const pendingBySubject = new Map<string, number>();
  for (const t of data.tasks) {
    if (!t.subject) continue;
    const key = norm(t.subject);
    if (!key) continue;
    ensure(key, titleCase(t.subject));
    if (!t.completed) {
      pendingBySubject.set(key, (pendingBySubject.get(key) ?? 0) + 1);
    }
  }
  for (const c of data.courses) {
    const key = norm(c.name);
    if (key) ensure(key, titleCase(c.name));
  }

  // Last review per subject: most recent study session whose title references it.
  const lastTouch = new Map<string, number>();
  for (const s of data.sessions) {
    const t = norm(s.title);
    if (!t) continue;
    for (const key of subjectMap.keys()) {
      if (key && (t.includes(key) || key.includes(t))) {
        const ts = s.createdAt.getTime();
        lastTouch.set(key, Math.max(lastTouch.get(key) ?? 0, ts));
      }
    }
  }

  const subjects: SubjectStat[] = [];
  for (const [key, a] of subjectMap) {
    const lastTs = Math.max(a.lastAttempt ?? 0, lastTouch.get(key) ?? 0);
    subjects.push({
      subject: a.display,
      accuracy: a.attempts > 0 ? Math.round(a.accSum / a.attempts) : null,
      attempts: a.attempts,
      daysSinceReview: lastTs > 0 ? daysBetween(now, new Date(lastTs)) : null,
      pendingTasks: pendingBySubject.get(key) ?? 0,
    });
  }

  // Weakest = lowest accuracy among subjects with attempts.
  const scored = subjects.filter((s) => s.accuracy !== null);
  const weakestSubject =
    scored.length > 0
      ? scored.reduce((lo, s) => (s.accuracy! < lo.accuracy! ? s : lo))
      : null;
  const strongestSubject =
    scored.length > 0
      ? scored.reduce((hi, s) => (s.accuracy! > hi.accuracy! ? s : hi))
      : null;

  // Most improved: largest positive recent-vs-older accuracy delta.
  let mostImprovedSubject: CoachSnapshot["mostImprovedSubject"] = null;
  for (const [, a] of subjectMap) {
    if (a.recentN > 0 && a.olderN > 0) {
      const delta = a.recentAccSum / a.recentN - a.olderAccSum / a.olderN;
      if (delta > 0 && (!mostImprovedSubject || delta > mostImprovedSubject.delta)) {
        mostImprovedSubject = { subject: a.display, delta: Math.round(delta) };
      }
    }
  }

  const staleSubjects = subjects
    .filter(
      (s) =>
        (s.daysSinceReview === null || s.daysSinceReview >= 5) &&
        (s.attempts > 0 || s.pendingTasks > 0)
    )
    .sort((a, b) => (b.daysSinceReview ?? 999) - (a.daysSinceReview ?? 999));

  // ---- Overall accuracy + trend ----
  const allAcc = data.quizResults.map((r) =>
    r.totalQuestions > 0 ? (r.score / r.totalQuestions) * 100 : 0
  );
  const averageAccuracy =
    allAcc.length > 0
      ? Math.round(allAcc.reduce((a, b) => a + b, 0) / allAcc.length)
      : null;

  const recentAcc = data.quizResults
    .filter((r) => r.completedAt.getTime() >= weekAgo)
    .map((r) => (r.totalQuestions > 0 ? (r.score / r.totalQuestions) * 100 : 0));
  const olderAcc = data.quizResults
    .filter(
      (r) =>
        r.completedAt.getTime() < weekAgo &&
        r.completedAt.getTime() >= twoWeeksAgo
    )
    .map((r) => (r.totalQuestions > 0 ? (r.score / r.totalQuestions) * 100 : 0));
  const avg = (xs: number[]) =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  const recentAvg = avg(recentAcc);
  const olderAvg = avg(olderAcc);
  const accuracyTrend =
    recentAvg !== null && olderAvg !== null
      ? Math.round(recentAvg - olderAvg)
      : null;

  // ---- Tasks & deadlines ----
  const pendingTasks = data.tasks.filter((t) => !t.completed).length;
  const missedTasks = data.tasks.filter(
    (t) => !t.completed && t.dueDate && new Date(t.dueDate).getTime() < today0
  ).length;
  const completedTasksThisWeek = data.tasks.filter(
    (t) => t.completed
  ).length; // tasks have no completedAt; count current completed as a soft signal

  const deadlines: DeadlineItem[] = [];
  for (const t of data.tasks) {
    if (t.completed || !t.dueDate) continue;
    const d = new Date(t.dueDate);
    const days = daysBetween(new Date(startOfDay(d)), new Date(today0));
    if (days < 0) continue;
    const isExam = /exam|test|final|midterm/i.test(t.title);
    deadlines.push({
      title: t.title,
      subject: t.subject || undefined,
      date: t.dueDate,
      daysRemaining: days,
      kind: isExam ? "exam" : "task",
      priority: t.priority,
    });
  }
  for (const g of data.goals) {
    if (!g.targetDate) continue;
    const d = new Date(g.targetDate);
    const days = daysBetween(new Date(startOfDay(d)), new Date(today0));
    if (days < 0) continue;
    deadlines.push({
      title: g.title,
      date: g.targetDate,
      daysRemaining: days,
      kind: /exam|test|final/i.test(g.title) ? "exam" : "goal",
    });
  }
  deadlines.sort((a, b) => a.daysRemaining - b.daysRemaining);

  const exams = deadlines.filter((d) => d.kind === "exam");
  const nextExam = exams[0] ?? null;
  const examMode = exams.some((e) => e.daysRemaining <= 5);

  // ---- Flashcards ----
  const staleDecks: StaleDeck[] = data.decks
    .map((d) => ({
      title: d.title,
      cardCount: d.cards.length,
      daysSinceStudied: d.lastStudied
        ? daysBetween(now, new Date(d.lastStudied))
        : null,
    }))
    .filter((d) => d.daysSinceStudied === null || d.daysSinceStudied >= 4)
    .sort((a, b) => (b.daysSinceStudied ?? 999) - (a.daysSinceStudied ?? 999));

  const sparse =
    data.sessions.length < 2 &&
    data.quizResults.length === 0 &&
    data.tasks.length === 0;

  return {
    firstName: data.firstName,
    generatedAt: now.toISOString(),
    game: data.game ?? null,
    activitiesThisWeek: sessionsThisWeek.length,
    activitiesLastWeek: sessionsLastWeek.length,
    studyMinutesThisWeek,
    streakDays,
    studiedToday,
    totalQuizAttempts: data.quizResults.length,
    averageAccuracy,
    accuracyTrend,
    subjects,
    weakestSubject,
    strongestSubject,
    mostImprovedSubject,
    staleSubjects,
    pendingTasks,
    missedTasks,
    completedTasksThisWeek,
    upcomingDeadlines: deadlines.slice(0, 6),
    nextExam,
    examMode,
    staleDecks: staleDecks.slice(0, 5),
    sparse,
  };
}

/**
 * Human-readable bulletized summary of the snapshot, fed to the AI as the
 * single source of truth. Keeps the model grounded in real numbers.
 */
export function snapshotToPrompt(s: CoachSnapshot): string {
  const lines: string[] = [];
  lines.push(`Student first name: ${s.firstName ?? "unknown"}`);
  lines.push(`Studied today: ${s.studiedToday ? "yes" : "no"}`);
  lines.push(`Current study streak: ${s.streakDays} day(s)`);
  lines.push(
    `Study activities this week: ${s.activitiesThisWeek} (last week: ${s.activitiesLastWeek})`
  );
  if (s.studyMinutesThisWeek > 0)
    lines.push(`Tracked study minutes this week: ${s.studyMinutesThisWeek}`);
  lines.push(`Total quiz attempts: ${s.totalQuizAttempts}`);
  if (s.averageAccuracy !== null)
    lines.push(`Average quiz accuracy: ${s.averageAccuracy}%`);
  if (s.accuracyTrend !== null)
    lines.push(
      `Quiz accuracy change vs last week: ${s.accuracyTrend > 0 ? "+" : ""}${s.accuracyTrend} points`
    );

  if (s.subjects.length) {
    lines.push("Subjects:");
    for (const sub of s.subjects) {
      const parts = [`  - ${sub.subject}:`];
      if (sub.accuracy !== null)
        parts.push(`accuracy ${sub.accuracy}% over ${sub.attempts} attempt(s);`);
      else parts.push("no quiz attempts yet;");
      parts.push(
        sub.daysSinceReview === null
          ? "never reviewed;"
          : `last reviewed ${sub.daysSinceReview} day(s) ago;`
      );
      if (sub.pendingTasks > 0) parts.push(`${sub.pendingTasks} pending task(s)`);
      lines.push(parts.join(" "));
    }
  }
  if (s.weakestSubject)
    lines.push(
      `Weakest subject: ${s.weakestSubject.subject} (${s.weakestSubject.accuracy}%)`
    );
  if (s.strongestSubject)
    lines.push(
      `Strongest subject: ${s.strongestSubject.subject} (${s.strongestSubject.accuracy}%)`
    );
  if (s.mostImprovedSubject)
    lines.push(
      `Most improved: ${s.mostImprovedSubject.subject} (+${s.mostImprovedSubject.delta} points)`
    );

  lines.push(
    `Tasks: ${s.pendingTasks} pending, ${s.missedTasks} overdue, ${s.completedTasksThisWeek} completed.`
  );
  if (s.upcomingDeadlines.length) {
    lines.push("Upcoming deadlines:");
    for (const d of s.upcomingDeadlines)
      lines.push(
        `  - ${d.title}${d.subject ? ` (${d.subject})` : ""} in ${d.daysRemaining} day(s) [${d.kind}]`
      );
  }
  if (s.nextExam)
    lines.push(
      `Next exam: ${s.nextExam.title} in ${s.nextExam.daysRemaining} day(s).`
    );
  if (s.staleDecks.length) {
    lines.push("Flashcard decks needing review:");
    for (const d of s.staleDecks)
      lines.push(
        `  - ${d.title} (${d.cardCount} cards, ${d.daysSinceStudied === null ? "never studied" : `${d.daysSinceStudied} day(s) ago`})`
      );
  }
  if (s.game) {
    const g = s.game;
    lines.push(
      `Gamification: Level ${g.level} (${g.totalXp} XP)${g.isMax ? " — max level" : `, ${g.xpToNext} XP to Level ${g.nextLevel}`}.`
    );
    lines.push(
      `Gamification streak: current ${g.currentStreak} day(s), longest ${g.longestStreak} day(s).`
    );
    if (g.nextAchievement)
      lines.push(
        `Closest achievement to unlock: "${g.nextAchievement.name}" (${g.nextAchievement.label}).`
      );
  }
  if (s.sparse)
    lines.push(
      "NOTE: very little data so far — encourage the student to start studying without inventing details."
    );
  return lines.join("\n");
}

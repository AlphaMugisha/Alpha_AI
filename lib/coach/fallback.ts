/**
 * Deterministic, no-AI coaching built purely from the snapshot facts.
 *
 * This is what the coach shows when the user has no API key configured, or
 * when an AI call fails. It is never random — every sentence is a direct
 * readout of real data, so the coach still feels personal and grounded.
 */

import { CoachSnapshot } from "./types";
import { DailyCoaching, WeeklyReport, CoachRecommendation, CoachInsight } from "./types";

function greeting(name: string | null): string {
  const hour = new Date().getHours();
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name}.` : `${part}.`;
}

export function buildFallbackDaily(s: CoachSnapshot): DailyCoaching {
  const recommendations: CoachRecommendation[] = [];
  const insights: CoachInsight[] = [];

  // --- Recommendations (ordered by urgency) ---
  if (s.nextExam && s.nextExam.daysRemaining <= 7) {
    recommendations.push({
      title: `Prepare for ${s.nextExam.title}`,
      reason: `It's in ${s.nextExam.daysRemaining} day(s). Prioritise focused revision now.`,
      action: "revise",
      subject: s.nextExam.subject,
    });
  }
  if (s.weakestSubject && s.weakestSubject.accuracy !== null && s.weakestSubject.accuracy < 70) {
    recommendations.push({
      title: `Review ${s.weakestSubject.subject}`,
      reason: `Your accuracy here is ${s.weakestSubject.accuracy}% — the lowest of your subjects.`,
      action: "explain",
      subject: s.weakestSubject.subject,
    });
  }
  for (const sub of s.staleSubjects.slice(0, 2)) {
    recommendations.push({
      title: `Revise ${sub.subject}`,
      reason:
        sub.daysSinceReview === null
          ? `You haven't reviewed ${sub.subject} yet.`
          : `You haven't reviewed ${sub.subject} in ${sub.daysSinceReview} days.`,
      action: "quiz",
      subject: sub.subject,
    });
  }
  for (const deck of s.staleDecks.slice(0, 1)) {
    recommendations.push({
      title: `Finish the "${deck.title}" deck`,
      reason:
        deck.daysSinceStudied === null
          ? `You created it but haven't studied it yet (${deck.cardCount} cards).`
          : `Last studied ${deck.daysSinceStudied} days ago.`,
      action: "revise",
    });
  }
  if (s.missedTasks > 0) {
    recommendations.push({
      title: `Catch up on ${s.missedTasks} overdue task(s)`,
      reason: "These are past their due date in your planner.",
      action: "task",
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      title: "Start a study session",
      reason: "Generate a quiz or review flashcards to build momentum today.",
      action: "quiz",
    });
  }

  // --- Insights (real-data observations) ---
  if (s.streakDays >= 2)
    insights.push({ text: `You're on a ${s.streakDays}-day study streak.`, tone: "positive" });
  if (s.accuracyTrend !== null && s.accuracyTrend > 0)
    insights.push({
      text: `Your quiz accuracy improved by ${s.accuracyTrend} points versus last week.`,
      tone: "positive",
    });
  if (s.accuracyTrend !== null && s.accuracyTrend < 0)
    insights.push({
      text: `Your quiz accuracy dropped ${Math.abs(s.accuracyTrend)} points versus last week.`,
      tone: "warning",
    });
  if (s.strongestSubject && s.strongestSubject.accuracy !== null)
    insights.push({
      text: `${s.strongestSubject.subject} is your strongest subject at ${s.strongestSubject.accuracy}%.`,
      tone: "positive",
    });
  if (s.mostImprovedSubject)
    insights.push({
      text: `${s.mostImprovedSubject.subject} is your most improved subject (+${s.mostImprovedSubject.delta} points).`,
      tone: "positive",
    });
  for (const sub of s.staleSubjects.slice(0, 1))
    insights.push({
      text:
        sub.daysSinceReview === null
          ? `You haven't reviewed ${sub.subject} yet.`
          : `You haven't studied ${sub.subject} in ${sub.daysSinceReview} days.`,
      tone: "warning",
    });
  if (s.game) {
    if (!s.game.isMax)
      insights.push({
        text: `You're Level ${s.game.level} — ${s.game.xpToNext} XP from Level ${s.game.nextLevel}.`,
        tone: "neutral",
      });
    if (s.game.nextAchievement)
      insights.push({
        text: `Almost there: ${s.game.nextAchievement.label} to unlock "${s.game.nextAchievement.name}".`,
        tone: "neutral",
      });
  }
  if (insights.length === 0)
    insights.push({
      text: "Complete a quiz or review session and I'll start tracking your strengths and weak spots.",
      tone: "neutral",
    });

  const prioritySubject =
    s.nextExam?.subject ||
    s.weakestSubject?.subject ||
    s.staleSubjects[0]?.subject ||
    null;

  const top = recommendations[0];

  let headline: string;
  if (s.examMode && s.nextExam)
    headline = `Exam mode: ${s.nextExam.title} is in ${s.nextExam.daysRemaining} days.`;
  else if (s.studiedToday)
    headline = "You've studied today — keep the momentum going.";
  else if (s.activitiesThisWeek > 0)
    headline = `You've logged ${s.activitiesThisWeek} study activities this week.`;
  else headline = "Let's get a study session in today.";

  let motivation: string;
  if (s.streakDays >= 3) motivation = `${s.streakDays}-day streak — excellent consistency.`;
  else if (s.accuracyTrend !== null && s.accuracyTrend > 0)
    motivation = `Your accuracy is trending up by ${s.accuracyTrend} points. Keep it up.`;
  else if (s.averageAccuracy !== null)
    motivation = `Your average quiz accuracy is ${s.averageAccuracy}%. Every session moves it forward.`;
  else motivation = "Small, consistent sessions add up fast. Let's begin.";

  return {
    greeting: greeting(s.firstName),
    headline,
    prioritySubject,
    recommendation: `${top.title}. ${top.reason}`,
    motivation,
    recommendations: recommendations.slice(0, 5),
    insights: insights.slice(0, 5),
  };
}

export function buildFallbackWeekly(s: CoachSnapshot): WeeklyReport {
  const hours = (s.studyMinutesThisWeek / 60).toFixed(1);
  const nextWeek: string[] = [];
  if (s.weakestSubject)
    nextWeek.push(`Focus extra time on ${s.weakestSubject.subject} (currently ${s.weakestSubject.accuracy}%).`);
  for (const sub of s.staleSubjects.slice(0, 2))
    nextWeek.push(`Revisit ${sub.subject} — overdue for review.`);
  if (s.nextExam)
    nextWeek.push(`Build a revision plan for ${s.nextExam.title} (${s.nextExam.daysRemaining} days away).`);
  if (nextWeek.length === 0)
    nextWeek.push("Keep a steady rhythm of quizzes and revision across your subjects.");

  return {
    summary:
      s.activitiesThisWeek > 0
        ? `You completed ${s.activitiesThisWeek} study activities this week${s.streakDays >= 2 ? ` and held a ${s.streakDays}-day streak` : ""}.`
        : "It was a quiet week — let's rebuild momentum.",
    totalHours: s.studyMinutesThisWeek > 0 ? `${hours} hours` : `${s.activitiesThisWeek} sessions`,
    quizPerformance:
      s.averageAccuracy !== null
        ? `${s.averageAccuracy}% average accuracy across ${s.totalQuizAttempts} attempts`
        : "No quizzes taken yet",
    bestSubject: s.strongestSubject
      ? `${s.strongestSubject.subject} (${s.strongestSubject.accuracy}%)`
      : "—",
    weakestSubject: s.weakestSubject
      ? `${s.weakestSubject.subject} (${s.weakestSubject.accuracy}%)`
      : "—",
    mostImproved: s.mostImprovedSubject
      ? `${s.mostImprovedSubject.subject} (+${s.mostImprovedSubject.delta} pts)`
      : "—",
    nextWeek,
  };
}

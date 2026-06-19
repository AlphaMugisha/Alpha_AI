/**
 * AI layer for the Study Coach.
 *
 * Each function feeds the deterministic snapshot to the model as the ONLY
 * source of truth and asks for grounded, structured JSON. If the model fails,
 * is unconfigured, or returns garbage, we fall back to the deterministic
 * builders so the coach always works.
 */

import { AIConfig } from "@/types";
import { generateStructured } from "@/lib/ai";
import { CoachSnapshot, DailyCoaching, WeeklyReport, SmartPlan } from "./types";
import { snapshotToPrompt } from "./analytics";
import { buildFallbackDaily, buildFallbackWeekly } from "./fallback";

function parseJSON<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const match = raw.match(/[[{][\s\S]*[\]}]/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

const COACH_SYSTEM = `You are Jarvis, a personal AI study coach — part tutor, part mentor, part academic advisor.
You speak directly to ONE student, warmly and concisely. You may refer to yourself as Jarvis.
CRITICAL RULES:
- Use ONLY the facts in the DATA block. Never invent subjects, numbers, scores, streaks, or exams.
- If a value isn't in the DATA, don't mention it.
- Reference the student's real numbers to show you understand them.
- Be encouraging but honest. No generic motivational quotes — use the student's actual achievements.
- Output ONLY valid JSON matching the requested shape. No markdown, no commentary.`;

export async function generateDailyCoaching(
  config: AIConfig,
  snapshot: CoachSnapshot
): Promise<DailyCoaching> {
  if (!config.apiKey?.trim()) return buildFallbackDaily(snapshot);

  const prompt = `DATA:
${snapshotToPrompt(snapshot)}

Produce today's coaching as JSON with this exact shape:
{
  "greeting": "short personal greeting using the student's name and time of day",
  "headline": "one sentence on where the student stands right now",
  "prioritySubject": "the single subject to prioritise today, or null",
  "recommendation": "the most important specific recommendation for today, referencing real data",
  "motivation": "a genuine, specific encouragement based on a real achievement in the data",
  "recommendations": [
    { "title": "short action", "reason": "why, citing real data", "action": "plan|explain|quiz|revise|task", "subject": "optional subject" }
  ],
  "insights": [
    { "text": "a real observation about this student's behavior/progress", "tone": "positive|neutral|warning" }
  ]
}
Give 3-5 recommendations and 3-5 insights. Keep every string under 160 characters.`;

  try {
    const raw = await generateStructured(config, prompt, COACH_SYSTEM);
    const parsed = parseJSON<DailyCoaching>(raw);
    if (parsed && parsed.recommendation && Array.isArray(parsed.recommendations)) {
      // Backfill anything the model omitted from the deterministic version.
      const fb = buildFallbackDaily(snapshot);
      return {
        greeting: parsed.greeting || fb.greeting,
        headline: parsed.headline || fb.headline,
        prioritySubject: parsed.prioritySubject ?? fb.prioritySubject,
        recommendation: parsed.recommendation || fb.recommendation,
        motivation: parsed.motivation || fb.motivation,
        recommendations: parsed.recommendations.length ? parsed.recommendations : fb.recommendations,
        insights: Array.isArray(parsed.insights) && parsed.insights.length ? parsed.insights : fb.insights,
      };
    }
  } catch {
    // fall through
  }
  return buildFallbackDaily(snapshot);
}

export async function generateWeeklyReport(
  config: AIConfig,
  snapshot: CoachSnapshot
): Promise<WeeklyReport> {
  if (!config.apiKey?.trim()) return buildFallbackWeekly(snapshot);

  const prompt = `DATA:
${snapshotToPrompt(snapshot)}

Write this week's study report as JSON:
{
  "summary": "2-3 sentence narrative of the week using real numbers",
  "totalHours": "string e.g. '3.5 hours' or session count if minutes unavailable",
  "quizPerformance": "string e.g. '72% average over 5 attempts'",
  "bestSubject": "subject (score) or '—'",
  "weakestSubject": "subject (score) or '—'",
  "mostImproved": "subject (+pts) or '—'",
  "nextWeek": ["3-4 concrete recommendations for next week based on the data"]
}`;

  try {
    const raw = await generateStructured(config, prompt, COACH_SYSTEM);
    const parsed = parseJSON<WeeklyReport>(raw);
    if (parsed && parsed.summary && Array.isArray(parsed.nextWeek)) {
      const fb = buildFallbackWeekly(snapshot);
      return { ...fb, ...parsed, nextWeek: parsed.nextWeek.length ? parsed.nextWeek : fb.nextWeek };
    }
  } catch {
    // fall through
  }
  return buildFallbackWeekly(snapshot);
}

export async function generateSmartPlan(
  config: AIConfig,
  snapshot: CoachSnapshot,
  options: { days: number; minutesPerDay: number }
): Promise<SmartPlan> {
  const prompt = `DATA:
${snapshotToPrompt(snapshot)}

Build a personalised ${options.days}-day study timetable. The student has about ${options.minutesPerDay} minutes per day.
Prioritise weak subjects, overdue revision, and any upcoming exam. Balance subjects across days.
Return JSON:
{
  "title": "plan title",
  "rationale": "1-2 sentences explaining how this plan targets the student's real weak spots and deadlines",
  "days": [
    { "day": "Day 1 (Mon)", "blocks": [ { "subject": "subject", "minutes": 45, "focus": "what to do" } ] }
  ]
}
Each day's blocks should sum to roughly ${options.minutesPerDay} minutes. Use ONLY subjects present in the DATA where possible.`;

  if (!config.apiKey?.trim()) {
    throw new Error("Add an AI API key in Settings to generate a smart study plan.");
  }

  const raw = await generateStructured(config, prompt, COACH_SYSTEM);
  const parsed = parseJSON<SmartPlan>(raw);
  if (!parsed || !Array.isArray(parsed.days) || parsed.days.length === 0) {
    throw new Error("Could not build a study plan. Please try again.");
  }
  return parsed;
}

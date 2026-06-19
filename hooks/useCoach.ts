"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./useAuth";
import { useSettings } from "./useSettings";
import { computeSnapshot } from "@/lib/coach/analytics";
import {
  loadCoachData,
  coachStateDb,
  todayKey,
  weekKey,
} from "@/lib/coach/db";
import {
  generateDailyCoaching,
  generateWeeklyReport,
  generateSmartPlan,
} from "@/lib/coach/ai";
import { CoachSnapshot, DailyCoaching, WeeklyReport, SmartPlan } from "@/lib/coach/types";

export function useCoach() {
  const { user, profile } = useAuth();
  const { aiConfig } = useSettings();
  const firstName = profile?.full_name?.trim().split(" ")[0] ?? null;

  const [snapshot, setSnapshot] = useState<CoachSnapshot | null>(null);
  const [daily, setDaily] = useState<DailyCoaching | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const generatedFor = useRef<string | null>(null);

  // Keep the latest config available to callbacks without re-triggering loads.
  const configRef = useRef(aiConfig);
  configRef.current = aiConfig;

  const load = useCallback(async () => {
    if (!user) {
      setSnapshot(null);
      setDaily(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const raw = await loadCoachData(firstName);
      const snap = computeSnapshot(raw);
      setSnapshot(snap);

      const key = todayKey();
      // Avoid regenerating within the same session for the same day.
      if (generatedFor.current === key && daily) {
        setLoading(false);
        return;
      }

      const cached = await coachStateDb.get<DailyCoaching>("daily", key);
      if (cached) {
        setDaily(cached);
        generatedFor.current = key;
      } else {
        const fresh = await generateDailyCoaching(configRef.current, snap);
        setDaily(fresh);
        generatedFor.current = key;
        coachStateDb.save("daily", key, fresh).catch(() => {});
      }
    } catch {
      // leave whatever we have
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, firstName]);

  useEffect(() => {
    load();
  }, [load]);

  /** Force a fresh AI generation for today, overwriting the cache. */
  const regenerate = useCallback(async () => {
    if (!user) return;
    setRegenerating(true);
    try {
      const raw = await loadCoachData(firstName);
      const snap = computeSnapshot(raw);
      setSnapshot(snap);
      const fresh = await generateDailyCoaching(configRef.current, snap);
      setDaily(fresh);
      const key = todayKey();
      generatedFor.current = key;
      await coachStateDb.save("daily", key, fresh).catch(() => {});
    } finally {
      setRegenerating(false);
    }
  }, [user, firstName]);

  /** Weekly report, cached per ISO week. `force` re-runs the model. */
  const getWeeklyReport = useCallback(
    async (force = false): Promise<WeeklyReport | null> => {
      if (!snapshot) return null;
      const key = weekKey();
      if (!force) {
        const cached = await coachStateDb.get<WeeklyReport>("weekly", key);
        if (cached) return cached;
      }
      const report = await generateWeeklyReport(configRef.current, snapshot);
      coachStateDb.save("weekly", key, report).catch(() => {});
      return report;
    },
    [snapshot]
  );

  const generatePlan = useCallback(
    (options: { days: number; minutesPerDay: number }): Promise<SmartPlan> => {
      if (!snapshot) throw new Error("Still loading your data — try again in a moment.");
      return generateSmartPlan(configRef.current, snapshot, options);
    },
    [snapshot]
  );

  return {
    snapshot,
    daily,
    loading,
    regenerating,
    regenerate,
    getWeeklyReport,
    generatePlan,
  };
}

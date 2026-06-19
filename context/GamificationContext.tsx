"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  loadGameState,
  loadWeeklyChallenges,
  loadDailyGoals,
  todayKey,
} from "@/lib/gamification/engine";
import { createDailyGoal, deleteDailyGoal } from "@/lib/gamification/db";
import { GameState, WeeklyChallenge, DailyGoal, RewardEvents } from "@/lib/gamification/types";
import { RewardOverlay } from "@/components/gamification/RewardOverlay";

interface GamificationValue {
  game: GameState | null;
  weeklyChallenges: WeeklyChallenge[];
  dailyGoals: DailyGoal[];
  loading: boolean;
  refresh: () => Promise<void>;
  generateDailyGoals: () => Promise<void>;
  addGoal: (g: { title: string; metric: DailyGoal["metric"]; target: number }) => Promise<void>;
  removeGoal: (id: string) => Promise<void>;
}

const Ctx = createContext<GamificationValue | null>(null);

export function useGamification() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useGamification must be used within GamificationProvider");
  return ctx;
}

export function GamificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [game, setGame] = useState<GameState | null>(null);
  const [weeklyChallenges, setWeeklyChallenges] = useState<WeeklyChallenge[]>([]);
  const [dailyGoals, setDailyGoals] = useState<DailyGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<RewardEvents[]>([]);
  const loadingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!user || loadingRef.current) return;
    loadingRef.current = true;
    try {
      const [g, wc, dg] = await Promise.all([
        loadGameState(),
        loadWeeklyChallenges(),
        loadDailyGoals(),
      ]);
      setGame(g);
      setWeeklyChallenges(wc);
      setDailyGoals(dg);
    } catch {
      // keep previous state
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setGame(null);
      setWeeklyChallenges([]);
      setDailyGoals([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    refresh();
  }, [user, refresh]);

  // Listen for activity rewards broadcast by the activity logger.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<RewardEvents>).detail;
      if (detail) setQueue((q) => [...q, detail]);
      refresh();
    };
    window.addEventListener("alpha:reward", handler);
    return () => window.removeEventListener("alpha:reward", handler);
  }, [refresh]);

  const generateDailyGoals = useCallback(async () => {
    if (!user || !game) return;
    const date = todayKey();
    // Sensible, data-aware defaults — light enough to finish in a day.
    const defaults: { title: string; metric: DailyGoal["metric"]; target: number }[] = [
      { title: "Complete 2 quizzes", metric: "quiz", target: 2 },
      { title: "Study for 30 minutes", metric: "minutes", target: 30 },
      { title: "Study flashcards once", metric: "flashcards", target: 1 },
      { title: "Log 3 study activities", metric: "session", target: 3 },
    ];
    await Promise.all(
      defaults.map((g) =>
        createDailyGoal({ ...g, dateKey: date, xpReward: 50 })
      )
    );
    await refresh();
  }, [user, game, refresh]);

  const addGoal = useCallback(
    async (g: { title: string; metric: DailyGoal["metric"]; target: number }) => {
      await createDailyGoal({ ...g, dateKey: todayKey(), xpReward: 50 });
      await refresh();
    },
    [refresh]
  );

  const removeGoal = useCallback(
    async (id: string) => {
      await deleteDailyGoal(id);
      await refresh();
    },
    [refresh]
  );

  const dismissCurrent = useCallback(() => {
    setQueue((q) => q.slice(1));
  }, []);

  return (
    <Ctx.Provider
      value={{
        game,
        weeklyChallenges,
        dailyGoals,
        loading,
        refresh,
        generateDailyGoals,
        addGoal,
        removeGoal,
      }}
    >
      {children}
      <RewardOverlay reward={queue[0] ?? null} onDismiss={dismissCurrent} />
    </Ctx.Provider>
  );
}

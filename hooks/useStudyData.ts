"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { sessionDb } from "@/lib/db";
import { StudySession } from "@/types";
import { awardForActivity } from "@/lib/gamification/award";
import { useAuth } from "./useAuth";

async function countRows(table: string): Promise<number> {
  const { count } = await createClient()
    .from(table)
    .select("*", { count: "exact", head: true });
  return count ?? 0;
}

export function useStudyData() {
  const { user } = useAuth();
  const [recentSessions, setRecentSessions] = useState<StudySession[]>([]);
  const [stats, setStats] = useState({
    totalNotes: 0,
    totalQuizzes: 0,
    totalFlashcardDecks: 0,
    totalChats: 0,
    totalSessions: 0,
  });

  const refresh = useCallback(async () => {
    if (!user) {
      setRecentSessions([]);
      setStats({
        totalNotes: 0,
        totalQuizzes: 0,
        totalFlashcardDecks: 0,
        totalChats: 0,
        totalSessions: 0,
      });
      return;
    }
    try {
      const [sessions, totalNotes, totalQuizzes, totalFlashcardDecks, totalChats, totalSessions] =
        await Promise.all([
          sessionDb.getAll(),
          countRows("notes"),
          countRows("quizzes"),
          countRows("flashcard_decks"),
          countRows("chat_sessions"),
          countRows("study_sessions"),
        ]);
      setRecentSessions(sessions.slice(0, 10));
      setStats({ totalNotes, totalQuizzes, totalFlashcardDecks, totalChats, totalSessions });
    } catch {
      // Network/auth hiccup — keep previous state
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addSession = useCallback(
    async (
      type: StudySession["type"],
      title: string,
      extra?: Partial<StudySession>
    ) => {
      if (!user) return;
      try {
        await sessionDb.add({
          id: "",
          type,
          title,
          createdAt: new Date(),
          ...extra,
        });
        // Award XP / streak / achievements for this activity (best-effort).
        await awardForActivity(type, { score: extra?.score });
        await refresh();
      } catch {
        // ignore — activity logging is best-effort
      }
    },
    [user, refresh]
  );

  return { recentSessions, stats, refresh, addSession };
}

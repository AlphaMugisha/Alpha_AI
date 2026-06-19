"use client";

import { StudySession } from "@/types";
import { recordActivity } from "./engine";
import { RewardEvents } from "./types";

/**
 * Fire-and-safe entry point used by the activity logger. Records the activity,
 * then broadcasts a `alpha:reward` event so the GamificationProvider can play
 * celebration animations and refresh state. Never throws.
 */
export async function awardForActivity(
  type: StudySession["type"],
  ctx?: { score?: number }
): Promise<RewardEvents | null> {
  try {
    const events = await recordActivity(type, ctx);
    if (
      typeof window !== "undefined" &&
      (events.xpGained > 0 || events.unlocked.length > 0 || events.leveledUp)
    ) {
      window.dispatchEvent(new CustomEvent("alpha:reward", { detail: events }));
    }
    return events;
  } catch {
    return null;
  }
}

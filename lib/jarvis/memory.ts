"use client";

/**
 * Jarvis's long-term memory of the user — short durable facts it learns across
 * conversations (interests, personality, goals, how they like to be talked to),
 * so it genuinely feels like it knows you. Stored per-user, RLS owner-only.
 */

import { createClient } from "@/lib/supabase/client";
import { AIConfig } from "@/types";
import { generateStructured } from "@/lib/ai";

function sb() {
  return createClient();
}

export async function getJarvisMemory(): Promise<string[]> {
  const { data } = await sb().from("jarvis_memory").select("facts").maybeSingle();
  const facts = data?.facts;
  return Array.isArray(facts) ? (facts as string[]) : [];
}

export async function saveJarvisMemory(facts: string[]): Promise<void> {
  await sb()
    .from("jarvis_memory")
    .upsert(
      { facts: facts.slice(0, 20), updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
}

interface Turn {
  role: "user" | "assistant";
  text: string;
}

function parseFacts(raw: string): string[] | null {
  try {
    const obj = JSON.parse(raw);
    if (Array.isArray(obj)) return obj as string[];
    if (Array.isArray(obj?.facts)) return obj.facts as string[];
  } catch {
    const m = raw.match(/\[[\s\S]*\]/);
    if (m) {
      try {
        return JSON.parse(m[0]) as string[];
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * After a conversation, distil any new durable facts about the user and merge
 * them with what Jarvis already knew. Best-effort — returns the merged list (or
 * the existing one unchanged on failure).
 */
export async function updateJarvisMemory(
  config: AIConfig,
  existing: string[],
  conversation: Turn[]
): Promise<string[]> {
  if (!config.apiKey?.trim() || conversation.length < 2) return existing;

  const transcript = conversation
    .map((t) => `${t.role === "user" ? "User" : "Jarvis"}: ${t.text}`)
    .join("\n");

  const prompt = `You maintain a long-term memory of a user for their personal AI companion, Jarvis.

Things already known about the user:
${existing.length ? existing.map((f) => `- ${f}`).join("\n") : "(nothing yet)"}

Recent conversation:
${transcript.slice(0, 4000)}

Return an updated JSON array of short, durable facts worth remembering about the USER (their interests, personality, mood, goals, preferences, how they like to be spoken to, name details, etc.).
Rules:
- Keep existing facts that still hold; add new ones; drop anything contradicted.
- Each fact is one short sentence. Max 18 facts. No duplicates.
- Only real, useful facts about the user — NOT about Jarvis, and not trivia from the chat.
Return ONLY the JSON array of strings.`;

  try {
    const raw = await generateStructured(config, prompt);
    const facts = parseFacts(raw);
    if (facts && facts.length) {
      const cleaned = Array.from(
        new Set(facts.map((f) => String(f).trim()).filter(Boolean))
      ).slice(0, 18);
      await saveJarvisMemory(cleaned);
      return cleaned;
    }
  } catch {
    // keep existing
  }
  return existing;
}

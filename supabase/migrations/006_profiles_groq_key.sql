-- ============================================================
-- StudyPilot AI — Migration 006: Groq API key
-- Free, OpenAI-compatible provider (console.groq.com).
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS groq_api_key TEXT NOT NULL DEFAULT '';

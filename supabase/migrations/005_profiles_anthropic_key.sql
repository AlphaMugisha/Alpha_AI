-- ============================================================
-- StudyPilot AI — Migration 005: Anthropic (Claude) API key
-- Adds a third AI provider key alongside gemini_api_key / openai_api_key.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS anthropic_api_key TEXT NOT NULL DEFAULT '';

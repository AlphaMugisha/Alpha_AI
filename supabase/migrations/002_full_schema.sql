-- ============================================================
-- StudyPilot AI — Migration 002: Full Application Schema
-- Run this in your Supabase SQL Editor after 001_auth_profiles.sql
-- ============================================================

-- ── Shared helper (idempotent) ────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  NOTES                                                   ║
-- ╚══════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS public.notes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL DEFAULT 'Untitled Note',
  content     TEXT        NOT NULL DEFAULT '',
  source_file TEXT,
  tags        TEXT[]      NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes: owner full access"
  ON public.notes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS notes_user_id_idx     ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS notes_created_at_idx  ON public.notes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notes_tags_idx        ON public.notes USING GIN(tags);

DROP TRIGGER IF EXISTS notes_updated_at ON public.notes;
CREATE TRIGGER notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ╔══════════════════════════════════════════════════════════╗
-- ║  CHAT SESSIONS & MESSAGES                                ║
-- ╚══════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_sessions: owner full access"
  ON public.chat_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS chat_sessions_user_id_idx    ON public.chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS chat_sessions_updated_at_idx ON public.chat_sessions(user_id, updated_at DESC);

DROP TRIGGER IF EXISTS chat_sessions_updated_at ON public.chat_sessions;
CREATE TRIGGER chat_sessions_updated_at
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


CREATE TABLE IF NOT EXISTS public.chat_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID        NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_messages: owner full access"
  ON public.chat_messages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS chat_messages_session_id_idx ON public.chat_messages(session_id);
CREATE INDEX IF NOT EXISTS chat_messages_user_id_idx    ON public.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx ON public.chat_messages(session_id, created_at ASC);

-- Bump parent session's updated_at when a new message is added
CREATE OR REPLACE FUNCTION public.touch_chat_session()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.chat_sessions SET updated_at = NOW() WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS chat_messages_touch_session ON public.chat_messages;
CREATE TRIGGER chat_messages_touch_session
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_chat_session();


-- ╔══════════════════════════════════════════════════════════╗
-- ║  QUIZZES & RESULTS                                       ║
-- ╚══════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS public.quizzes (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title          TEXT        NOT NULL DEFAULT 'Untitled Quiz',
  difficulty     TEXT        NOT NULL DEFAULT 'intermediate'
                             CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  source_content TEXT,
  -- questions stored as JSONB array: [{id, question, options[], correctAnswer, explanation}]
  questions      JSONB       NOT NULL DEFAULT '[]',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quizzes: owner full access"
  ON public.quizzes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS quizzes_user_id_idx    ON public.quizzes(user_id);
CREATE INDEX IF NOT EXISTS quizzes_created_at_idx ON public.quizzes(user_id, created_at DESC);

DROP TRIGGER IF EXISTS quizzes_updated_at ON public.quizzes;
CREATE TRIGGER quizzes_updated_at
  BEFORE UPDATE ON public.quizzes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


CREATE TABLE IF NOT EXISTS public.quiz_results (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id         UUID        NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  score           INTEGER     NOT NULL CHECK (score >= 0),
  total_questions INTEGER     NOT NULL CHECK (total_questions > 0),
  -- answers: array of chosen option indexes matching questions order
  answers         INTEGER[]   NOT NULL DEFAULT '{}',
  completed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quiz_results: owner full access"
  ON public.quiz_results FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS quiz_results_user_id_idx   ON public.quiz_results(user_id);
CREATE INDEX IF NOT EXISTS quiz_results_quiz_id_idx   ON public.quiz_results(quiz_id);
CREATE INDEX IF NOT EXISTS quiz_results_completed_idx ON public.quiz_results(user_id, completed_at DESC);


-- ╔══════════════════════════════════════════════════════════╗
-- ║  FLASHCARD DECKS & CARDS                                 ║
-- ╚══════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS public.flashcard_decks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL DEFAULT 'Untitled Deck',
  last_studied TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.flashcard_decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flashcard_decks: owner full access"
  ON public.flashcard_decks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS flashcard_decks_user_id_idx    ON public.flashcard_decks(user_id);
CREATE INDEX IF NOT EXISTS flashcard_decks_created_at_idx ON public.flashcard_decks(user_id, created_at DESC);

DROP TRIGGER IF EXISTS flashcard_decks_updated_at ON public.flashcard_decks;
CREATE TRIGGER flashcard_decks_updated_at
  BEFORE UPDATE ON public.flashcard_decks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


CREATE TABLE IF NOT EXISTS public.flashcards (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id    UUID        NOT NULL REFERENCES public.flashcard_decks(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  front      TEXT        NOT NULL,
  back       TEXT        NOT NULL,
  -- spaced repetition fields
  ease_factor   NUMERIC(4,2) NOT NULL DEFAULT 2.5,
  interval_days INTEGER      NOT NULL DEFAULT 1,
  due_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flashcards: owner full access"
  ON public.flashcards FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS flashcards_deck_id_idx  ON public.flashcards(deck_id);
CREATE INDEX IF NOT EXISTS flashcards_user_id_idx  ON public.flashcards(user_id);
CREATE INDEX IF NOT EXISTS flashcards_due_at_idx   ON public.flashcards(user_id, due_at ASC);

DROP TRIGGER IF EXISTS flashcards_updated_at ON public.flashcards;
CREATE TRIGGER flashcards_updated_at
  BEFORE UPDATE ON public.flashcards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Bump deck updated_at when a card changes
CREATE OR REPLACE FUNCTION public.touch_flashcard_deck()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.flashcard_decks SET updated_at = NOW() WHERE id = NEW.deck_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS flashcards_touch_deck ON public.flashcards;
CREATE TRIGGER flashcards_touch_deck
  AFTER INSERT OR UPDATE ON public.flashcards
  FOR EACH ROW EXECUTE FUNCTION public.touch_flashcard_deck();


-- ╔══════════════════════════════════════════════════════════╗
-- ║  STUDY SESSIONS (activity log)                           ║
-- ╚══════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS public.study_sessions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL CHECK (type IN ('chat','notes','quiz','flashcards','explain','planner')),
  title      TEXT        NOT NULL DEFAULT '',
  duration   INTEGER,          -- minutes
  score      INTEGER,          -- percentage 0-100, for quiz/flashcard sessions
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "study_sessions: owner full access"
  ON public.study_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS study_sessions_user_id_idx    ON public.study_sessions(user_id);
CREATE INDEX IF NOT EXISTS study_sessions_created_at_idx ON public.study_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS study_sessions_type_idx       ON public.study_sessions(user_id, type);


-- ╔══════════════════════════════════════════════════════════╗
-- ║  STUDY TASKS (planner)                                   ║
-- ╚══════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS public.study_tasks (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title             TEXT        NOT NULL,
  subject           TEXT        NOT NULL DEFAULT '',
  due_date          DATE        NOT NULL,
  priority          TEXT        NOT NULL DEFAULT 'medium'
                                CHECK (priority IN ('low','medium','high')),
  completed         BOOLEAN     NOT NULL DEFAULT FALSE,
  estimated_minutes INTEGER     NOT NULL DEFAULT 30,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.study_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "study_tasks: owner full access"
  ON public.study_tasks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS study_tasks_user_id_idx    ON public.study_tasks(user_id);
CREATE INDEX IF NOT EXISTS study_tasks_due_date_idx   ON public.study_tasks(user_id, due_date ASC);
CREATE INDEX IF NOT EXISTS study_tasks_completed_idx  ON public.study_tasks(user_id, completed);
CREATE INDEX IF NOT EXISTS study_tasks_priority_idx   ON public.study_tasks(user_id, priority);

DROP TRIGGER IF EXISTS study_tasks_updated_at ON public.study_tasks;
CREATE TRIGGER study_tasks_updated_at
  BEFORE UPDATE ON public.study_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ╔══════════════════════════════════════════════════════════╗
-- ║  STUDY GOALS                                             ║
-- ╚══════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS public.study_goals (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  target_date DATE        NOT NULL,
  progress    INTEGER     NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  milestones  TEXT[]      NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.study_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "study_goals: owner full access"
  ON public.study_goals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS study_goals_user_id_idx    ON public.study_goals(user_id);
CREATE INDEX IF NOT EXISTS study_goals_target_date_idx ON public.study_goals(user_id, target_date ASC);

DROP TRIGGER IF EXISTS study_goals_updated_at ON public.study_goals;
CREATE TRIGGER study_goals_updated_at
  BEFORE UPDATE ON public.study_goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ╔══════════════════════════════════════════════════════════╗
-- ║  ANALYTICS VIEW (computed, no extra storage)             ║
-- ╚══════════════════════════════════════════════════════════╝
CREATE OR REPLACE VIEW public.user_analytics AS
SELECT
  ss.user_id,
  COUNT(*)                                    AS total_sessions,
  COALESCE(SUM(ss.duration), 0)               AS total_minutes,
  COALESCE(
    ROUND(AVG(ss.score) FILTER (WHERE ss.score IS NOT NULL))::INTEGER,
    0
  )                                           AS average_score,
  -- streak: consecutive days with at least one session ending today
  (
    WITH daily AS (
      SELECT DISTINCT DATE(created_at AT TIME ZONE 'UTC') AS d
      FROM   public.study_sessions s2
      WHERE  s2.user_id = ss.user_id
    ),
    numbered AS (
      SELECT d, ROW_NUMBER() OVER (ORDER BY d DESC) AS rn FROM daily
    )
    SELECT COUNT(*) FROM numbered
    WHERE  d = (CURRENT_DATE - (rn - 1) * INTERVAL '1 day')::DATE
  )                                           AS streak
FROM public.study_sessions ss
GROUP BY ss.user_id;

-- RLS does not apply to views by default; security handled via the underlying table.
-- Restrict access so users only see their own row.
ALTER VIEW public.user_analytics OWNER TO authenticated;
REVOKE ALL ON public.user_analytics FROM anon, public;
GRANT SELECT ON public.user_analytics TO authenticated;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  STORAGE BUCKET (for note attachments / file uploads)    ║
-- ╚══════════════════════════════════════════════════════════╝
INSERT INTO storage.buckets (id, name, public)
VALUES ('study-files', 'study-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "study-files: owner upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'study-files'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

CREATE POLICY "study-files: owner read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'study-files'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

CREATE POLICY "study-files: owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'study-files'
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

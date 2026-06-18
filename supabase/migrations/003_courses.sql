-- ============================================================
-- StudyPilot AI — Migration 003: Courses
-- Run after 002_full_schema.sql
-- A managed list of courses per user; notes belong to a course
-- so exams can be simulated from all files in a course.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.courses (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "courses: owner full access"
    ON public.courses FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS courses_user_id_idx ON public.courses(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS courses_user_name_uidx
  ON public.courses(user_id, lower(name));

-- Link notes to a course (nullable so existing notes are unaffected).
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS notes_course_id_idx ON public.notes(course_id);

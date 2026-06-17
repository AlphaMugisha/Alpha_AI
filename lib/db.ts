"use client";

/**
 * Supabase-backed data access layer for Alpha.
 *
 * Mirrors the old localStorage `lib/storage.ts` API but async + per-user.
 * Returns the same camelCase TS shapes the UI already uses, so pages only
 * need to await loads/saves — their rendering logic is unchanged.
 *
 * `user_id` is omitted on insert: the DB defaults it to auth.uid() and RLS
 * enforces ownership.
 */

import { createClient } from "@/lib/supabase/client";
import {
  ChatSession,
  Note,
  Quiz,
  QuizResult,
  FlashcardDeck,
  StudySession,
  StudyTask,
  CodingProject,
  ProjectTask,
} from "@/types";

function db() {
  return createClient();
}

// ----------------------------- mappers -----------------------------
/* eslint-disable @typescript-eslint/no-explicit-any */

function toNote(r: any): Note {
  return {
    id: r.id,
    title: r.title,
    content: r.content ?? "",
    sourceFile: r.source_file ?? undefined,
    createdAt: new Date(r.created_at),
    tags: r.tags ?? [],
  };
}

function toQuiz(r: any): Quiz {
  return {
    id: r.id,
    title: r.title,
    questions: r.questions ?? [],
    sourceContent: r.source_content ?? undefined,
    createdAt: new Date(r.created_at),
  };
}

function toQuizResult(r: any): QuizResult {
  return {
    quizId: r.quiz_id,
    score: r.score,
    totalQuestions: r.total_questions,
    answers: r.answers ?? [],
    completedAt: new Date(r.completed_at),
  };
}

function toDeck(r: any): FlashcardDeck {
  return {
    id: r.id,
    title: r.title,
    cards: r.cards ?? [],
    createdAt: new Date(r.created_at),
    lastStudied: r.last_studied ? new Date(r.last_studied) : undefined,
  };
}

function toChat(r: any): ChatSession {
  return {
    id: r.id,
    title: r.title,
    messages: r.messages ?? [],
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}

function toStudySession(r: any): StudySession {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    duration: r.duration ?? undefined,
    score: r.score ?? undefined,
    createdAt: new Date(r.created_at),
  };
}

function toTask(r: any): StudyTask {
  return {
    id: r.id,
    title: r.title,
    subject: r.subject ?? "",
    dueDate: r.due_date ?? "",
    priority: r.priority,
    completed: r.completed,
    estimatedMinutes: r.estimated_minutes ?? 0,
    notes: r.notes ?? undefined,
  };
}

// ----------------------------- notes -----------------------------
export const notesDb = {
  async getAll(): Promise<Note[]> {
    const { data, error } = await db()
      .from("notes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toNote);
  },
  async save(note: Note): Promise<void> {
    const { error } = await db().from("notes").upsert({
      id: note.id,
      title: note.title,
      content: note.content,
      source_file: note.sourceFile ?? null,
      tags: note.tags ?? [],
    });
    if (error) throw error;
  },
  async delete(id: string): Promise<void> {
    const { error } = await db().from("notes").delete().eq("id", id);
    if (error) throw error;
  },
};

// ----------------------------- quizzes -----------------------------
export const quizDb = {
  async getAll(): Promise<Quiz[]> {
    const { data, error } = await db()
      .from("quizzes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toQuiz);
  },
  async save(quiz: Quiz): Promise<void> {
    const { error } = await db().from("quizzes").upsert({
      id: quiz.id,
      title: quiz.title,
      questions: quiz.questions,
      source_content: quiz.sourceContent ?? null,
    });
    if (error) throw error;
  },
  async delete(id: string): Promise<void> {
    const { error } = await db().from("quizzes").delete().eq("id", id);
    if (error) throw error;
  },
  async saveResult(result: QuizResult): Promise<void> {
    const { error } = await db().from("quiz_results").insert({
      quiz_id: result.quizId,
      score: result.score,
      total_questions: result.totalQuestions,
      answers: result.answers,
    });
    if (error) throw error;
  },
  async getResults(): Promise<QuizResult[]> {
    const { data, error } = await db()
      .from("quiz_results")
      .select("*")
      .order("completed_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toQuizResult);
  },
};

// ----------------------------- flashcards -----------------------------
export const flashcardDb = {
  async getAll(): Promise<FlashcardDeck[]> {
    const { data, error } = await db()
      .from("flashcard_decks")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toDeck);
  },
  async save(deck: FlashcardDeck): Promise<void> {
    const { error } = await db().from("flashcard_decks").upsert({
      id: deck.id,
      title: deck.title,
      cards: deck.cards,
      last_studied: deck.lastStudied
        ? new Date(deck.lastStudied).toISOString()
        : null,
    });
    if (error) throw error;
  },
  async delete(id: string): Promise<void> {
    const { error } = await db().from("flashcard_decks").delete().eq("id", id);
    if (error) throw error;
  },
};

// ----------------------------- chat -----------------------------
export const chatDb = {
  async getAll(): Promise<ChatSession[]> {
    const { data, error } = await db()
      .from("chat_sessions")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toChat);
  },
  async save(session: ChatSession): Promise<void> {
    const { error } = await db().from("chat_sessions").upsert({
      id: session.id,
      title: session.title,
      messages: session.messages,
    });
    if (error) throw error;
  },
  async delete(id: string): Promise<void> {
    const { error } = await db().from("chat_sessions").delete().eq("id", id);
    if (error) throw error;
  },
};

// ----------------------------- study sessions (activity feed) -----------------------------
export const sessionDb = {
  async getAll(): Promise<StudySession[]> {
    const { data, error } = await db()
      .from("study_sessions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toStudySession);
  },
  async add(session: StudySession): Promise<void> {
    const { error } = await db().from("study_sessions").insert({
      type: session.type,
      title: session.title,
      duration: session.duration ?? null,
      score: session.score ?? null,
    });
    if (error) throw error;
  },
};

// ----------------------------- tasks -----------------------------
export const taskDb = {
  async getAll(): Promise<StudyTask[]> {
    const { data, error } = await db()
      .from("study_tasks")
      .select("*")
      .order("due_date", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(toTask);
  },
  async save(task: StudyTask): Promise<void> {
    const { error } = await db().from("study_tasks").upsert({
      id: task.id,
      title: task.title,
      subject: task.subject,
      due_date: task.dueDate || null,
      priority: task.priority,
      completed: task.completed,
      estimated_minutes: task.estimatedMinutes,
      notes: task.notes ?? null,
    });
    if (error) throw error;
  },
  async delete(id: string): Promise<void> {
    const { error } = await db().from("study_tasks").delete().eq("id", id);
    if (error) throw error;
  },
};

// ----------------------------- coding projects -----------------------------
function toProjectTask(r: any): ProjectTask {
  return {
    id: r.id,
    projectId: r.project_id,
    title: r.title,
    done: r.done,
    createdAt: new Date(r.created_at),
  };
}

function toProject(r: any): CodingProject {
  const tasks = (r.project_tasks ?? r.tasks ?? []).map(toProjectTask);
  tasks.sort(
    (a: ProjectTask, b: ProjectTask) =>
      a.createdAt.getTime() - b.createdAt.getTime()
  );
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? "",
    status: r.status,
    techStack: r.tech_stack ?? [],
    repoUrl: r.repo_url ?? undefined,
    liveUrl: r.live_url ?? undefined,
    priority: r.priority,
    progress: r.progress ?? 0,
    deadline: r.deadline ?? undefined,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
    tasks,
  };
}

export const projectDb = {
  async getAll(): Promise<CodingProject[]> {
    const { data, error } = await db()
      .from("coding_projects")
      .select("*, project_tasks(*)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toProject);
  },
  async save(project: CodingProject): Promise<void> {
    const { error } = await db().from("coding_projects").upsert({
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      tech_stack: project.techStack ?? [],
      repo_url: project.repoUrl || null,
      live_url: project.liveUrl || null,
      priority: project.priority,
      progress: project.progress,
      deadline: project.deadline || null,
    });
    if (error) throw error;
  },
  async delete(id: string): Promise<void> {
    const { error } = await db().from("coding_projects").delete().eq("id", id);
    if (error) throw error;
  },
};

export const projectTaskDb = {
  async add(projectId: string, title: string): Promise<ProjectTask> {
    const { data, error } = await db()
      .from("project_tasks")
      .insert({ project_id: projectId, title })
      .select()
      .single();
    if (error) throw error;
    return toProjectTask(data);
  },
  async toggle(id: string, done: boolean): Promise<void> {
    const { error } = await db()
      .from("project_tasks")
      .update({ done })
      .eq("id", id);
    if (error) throw error;
  },
  async delete(id: string): Promise<void> {
    const { error } = await db().from("project_tasks").delete().eq("id", id);
    if (error) throw error;
  },
};

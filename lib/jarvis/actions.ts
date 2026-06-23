"use client";

/**
 * Jarvis's "hands" — lets Jarvis actually DO things in the app, not just talk.
 *
 * How it works (provider-agnostic, so it works on Gemini/OpenAI/Anthropic/Groq
 * which only share a plain-text interface): Jarvis is taught to append a single
 * machine-readable block to its reply:
 *
 *     <actions>[ { "type": "create_task", "title": "..." } ]</actions>
 *
 * The conversational part before the block is what gets shown/spoken; the block
 * is parsed here and executed against the existing `lib/db.ts` data layer. Items
 * are referenced by name/title (natural for voice) and resolved to IDs from a
 * live inventory snapshot we feed into Jarvis's context.
 */

import {
  taskDb,
  notesDb,
  coursesDb,
  flashcardDb,
  quizDb,
  projectDb,
  projectTaskDb,
} from "@/lib/db";
import { generateFlashcards, generateNotes, generateQuiz } from "@/lib/ai";
import { generateId } from "@/lib/utils";
import { AIConfig, StudyTask } from "@/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface JarvisAction {
  type: string;
  [key: string]: any;
}

export interface ActionContext {
  aiConfig: AIConfig;
  navigate: (route: string) => void;
}

// ----------------------------- inventory -----------------------------
// A compact snapshot of what the user currently has, so Jarvis can reference
// real items by name and we can resolve them to IDs for edit/delete actions.

export interface Inventory {
  tasks: { id: string; title: string; completed: boolean }[];
  notes: { id: string; title: string }[];
  courses: { id: string; name: string }[];
  decks: { id: string; title: string }[];
  quizzes: { id: string; title: string }[];
  projects: {
    id: string;
    name: string;
    tasks: { id: string; title: string; done: boolean }[];
  }[];
}

export async function loadInventory(): Promise<Inventory> {
  const [tasks, notes, courses, decks, quizzes, projects] = await Promise.all([
    taskDb.getAll().catch(() => []),
    notesDb.getAll().catch(() => []),
    coursesDb.getAll().catch(() => []),
    flashcardDb.getAll().catch(() => []),
    quizDb.getAll().catch(() => []),
    projectDb.getAll().catch(() => []),
  ]);
  return {
    tasks: tasks.map((t) => ({ id: t.id, title: t.title, completed: t.completed })),
    notes: notes.map((n) => ({ id: n.id, title: n.title })),
    courses: courses.map((c) => ({ id: c.id, name: c.name })),
    decks: decks.map((d) => ({ id: d.id, title: d.title })),
    quizzes: quizzes.map((q) => ({ id: q.id, title: q.title })),
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      tasks: p.tasks.map((t) => ({ id: t.id, title: t.title, done: t.done })),
    })),
  };
}

export function inventoryToPrompt(inv: Inventory): string {
  const list = (label: string, items: string[]) =>
    items.length ? `${label}: ${items.join("; ")}` : `${label}: (none)`;
  const pending = inv.tasks.filter((t) => !t.completed).map((t) => t.title);
  const done = inv.tasks.filter((t) => t.completed).map((t) => t.title);
  return [
    list("Pending tasks", pending),
    list("Completed tasks", done),
    list("Notes", inv.notes.map((n) => n.title)),
    list("Courses", inv.courses.map((c) => c.name)),
    list("Flashcard decks", inv.decks.map((d) => d.title)),
    list("Quizzes", inv.quizzes.map((q) => q.title)),
    list(
      "Projects",
      inv.projects.map(
        (p) =>
          `${p.name}${p.tasks.length ? ` [tasks: ${p.tasks.map((t) => t.title).join(", ")}]` : ""}`
      )
    ),
  ].join("\n");
}

// ----------------------------- the system prompt -----------------------------

export const ACTIONS_PROMPT = `You can ACT inside the app, not just talk. When the user wants something created, added, made, removed, cleaned up, finished, checked off, opened, or shown — actually do it, even if they phrase it casually or vaguely ("toss that quiz", "I'm done with the essay task", "clean up my finished to-dos", "pull up my decks"). Infer which real item they mean from the list of their current items and use that item's exact name in the action. Don't ask them to type exact names — that's your job to figure out.

To perform actions, append ONE block to the very end of your reply, exactly like this:
<actions>[ {"type":"...", ...}, ... ]</actions>

CRITICAL: if your spoken reply claims or implies you did something (e.g. "Done — added that", "Opening your planner", "Deleted it"), you MUST include the matching action block. Saying you did it WITHOUT the block means nothing actually happens — that is a failure. Whenever in doubt, include the block. Output valid JSON only: double quotes, no trailing commas, no comments.

Rules for the action block:
- The text BEFORE the block is spoken to the user, so keep it short, natural and confident (e.g. "Done — added that to your planner."). NEVER read the block aloud or mention JSON.
- Put the block only when an action is actually needed. For pure chat, omit it entirely.
- Refer to existing items by their exact title/name as listed in the user's current items. If something doesn't exist, say so instead of inventing it.
- You may include several actions in the array; they run in order.
- Today's date is ${new Date().toISOString().slice(0, 10)}. Use ISO dates (YYYY-MM-DD) for dueDate.

Available action types:
- {"type":"create_task","title":"...","subject":"...","dueDate":"YYYY-MM-DD","priority":"low|medium|high","estimatedMinutes":60,"notes":"..."}  (only title is required)
- {"type":"complete_task","title":"..."}            mark a task done
- {"type":"delete_task","title":"..."}
- {"type":"create_note","title":"...","content":"..."}   OR  {"type":"create_note","title":"...","topic":"..."} to AI-generate the note
- {"type":"delete_note","title":"..."}
- {"type":"create_course","name":"..."}
- {"type":"delete_course","name":"..."}
- {"type":"create_deck","title":"...","topic":"...","count":12}   AI-generates flashcards on the topic
- {"type":"delete_deck","title":"..."}
- {"type":"create_quiz","title":"...","topic":"...","count":10}   AI-generates a quiz on the topic
- {"type":"delete_quiz","title":"..."}
- {"type":"create_project","name":"...","description":"...","status":"planning|in-progress|completed|on-hold","priority":"low|medium|high","techStack":["..."]}
- {"type":"delete_project","name":"..."}
- {"type":"add_project_task","project":"...","title":"..."}
- {"type":"complete_project_task","project":"...","title":"..."}
- {"type":"navigate","to":"dashboard|planner|notes|quiz|exam|flashcards|explain|chat|projects|repos|achievements|coach|profile|settings"}`;

// ----------------------------- parsing -----------------------------

export interface ParsedReply {
  say: string;
  actions: JarvisAction[];
}

export function parseActions(raw: string): ParsedReply {
  const text = raw ?? "";
  // Primary form: <actions>[ ... ]</actions>
  const tagged = text.match(/<actions>\s*([\s\S]*?)\s*<\/actions>/i);
  let jsonStr: string | null = null;
  let say = text;

  if (tagged) {
    jsonStr = tagged[1];
    say = text.slice(0, tagged.index).trim();
  } else {
    // Fallback: a trailing ```json fenced array or a bare trailing array.
    const fenced = text.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/i);
    if (fenced) {
      jsonStr = fenced[1];
      say = text.slice(0, fenced.index).trim();
    }
  }

  let actions: JarvisAction[] = [];
  if (jsonStr) {
    // Tolerate common model JSON slips (trailing commas, smart quotes) so a
    // tiny formatting error doesn't silently drop every action.
    const cleaned = jsonStr
      .trim()
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/,\s*([\]}])/g, "$1");
    for (const candidate of [jsonStr.trim(), cleaned]) {
      try {
        const parsed = JSON.parse(candidate);
        if (Array.isArray(parsed)) actions = parsed.filter((a) => a && a.type);
        else if (parsed && parsed.type) actions = [parsed];
        if (actions.length) break;
      } catch {
        /* try the cleaned variant next */
      }
    }
  }

  // Strip any stray action tags from the spoken text just in case.
  say = say.replace(/<\/?actions>/gi, "").trim();
  return { say, actions };
}

// ----------------------------- matching helpers -----------------------------

function normalize(s: string): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}

/** Find the item whose label best matches `query` (exact > contains > overlap). */
function findBest<T>(
  query: string,
  items: T[],
  label: (i: T) => string
): T | null {
  const q = normalize(query);
  if (!q) return null;
  let exact: T | null = null;
  let contains: T | null = null;
  let overlap: T | null = null;
  let bestOverlap = 0;
  const qWords = new Set(q.split(" ").filter(Boolean));
  for (const it of items) {
    const l = normalize(label(it));
    if (l === q) exact = it;
    else if (!contains && (l.includes(q) || q.includes(l))) contains = it;
    const lWords = l.split(" ").filter(Boolean);
    const shared = lWords.filter((w) => qWords.has(w)).length;
    if (shared > bestOverlap) {
      bestOverlap = shared;
      overlap = it;
    }
  }
  return exact ?? contains ?? (bestOverlap > 0 ? overlap : null);
}

const ROUTES: Record<string, string> = {
  dashboard: "/dashboard",
  planner: "/planner",
  notes: "/notes",
  quiz: "/quiz",
  exam: "/exam",
  flashcards: "/flashcards",
  explain: "/explain",
  chat: "/chat",
  projects: "/projects",
  repos: "/repos",
  achievements: "/achievements",
  coach: "/coach",
  profile: "/profile",
  settings: "/settings",
};

// ----------------------------- execution -----------------------------

/**
 * Run the actions in order. Returns a short human-readable result line per
 * action (already past-tense / confirmatory) for Jarvis to relay to the user.
 * Each action is best-effort: a failure becomes a polite error line, never throws.
 */
export async function executeActions(
  actions: JarvisAction[],
  inv: Inventory,
  ctx: ActionContext
): Promise<string[]> {
  const results: string[] = [];
  for (const a of actions) {
    try {
      results.push(await runOne(a, inv, ctx));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "something went wrong";
      results.push(`Couldn't ${a.type.replace(/_/g, " ")} — ${msg}.`);
    }
  }
  return results;
}

async function runOne(
  a: JarvisAction,
  inv: Inventory,
  ctx: ActionContext
): Promise<string> {
  switch (a.type) {
    // ---------------- tasks ----------------
    case "create_task": {
      const title = String(a.title ?? "").trim();
      if (!title) return "I need a task title to add it.";
      const task: StudyTask = {
        id: generateId(),
        title,
        subject: String(a.subject ?? "").trim(),
        dueDate: typeof a.dueDate === "string" ? a.dueDate : "",
        priority: ["low", "medium", "high"].includes(a.priority) ? a.priority : "medium",
        completed: false,
        estimatedMinutes: Number.isFinite(a.estimatedMinutes) ? a.estimatedMinutes : 60,
        notes: a.notes ? String(a.notes) : undefined,
      };
      await taskDb.save(task);
      inv.tasks.push({ id: task.id, title: task.title, completed: false });
      return `Added the task "${title}" to your planner.`;
    }
    case "complete_task": {
      const hit = findBest(String(a.title ?? ""), inv.tasks, (t) => t.title);
      if (!hit) return `I couldn't find a task called "${a.title}".`;
      const all = await taskDb.getAll();
      const full = all.find((t) => t.id === hit.id);
      if (!full) return `I couldn't find a task called "${a.title}".`;
      await taskDb.save({ ...full, completed: true });
      hit.completed = true;
      return `Marked "${hit.title}" as done.`;
    }
    case "delete_task": {
      const hit = findBest(String(a.title ?? ""), inv.tasks, (t) => t.title);
      if (!hit) return `I couldn't find a task called "${a.title}".`;
      await taskDb.delete(hit.id);
      inv.tasks = inv.tasks.filter((t) => t.id !== hit.id);
      return `Deleted the task "${hit.title}".`;
    }

    // ---------------- notes ----------------
    case "create_note": {
      const title = String(a.title ?? "").trim();
      if (!title) return "I need a title to create a note.";
      let content = typeof a.content === "string" ? a.content : "";
      if (!content && a.topic) {
        content = await generateNotes(ctx.aiConfig, String(a.topic), title);
      }
      const id = generateId();
      await notesDb.save({
        id,
        title,
        content,
        createdAt: new Date(),
        tags: [],
      });
      inv.notes.push({ id, title });
      return a.topic
        ? `Generated and saved notes titled "${title}".`
        : `Created the note "${title}".`;
    }
    case "delete_note": {
      const hit = findBest(String(a.title ?? ""), inv.notes, (n) => n.title);
      if (!hit) return `I couldn't find a note called "${a.title}".`;
      await notesDb.delete(hit.id);
      inv.notes = inv.notes.filter((n) => n.id !== hit.id);
      return `Deleted the note "${hit.title}".`;
    }

    // ---------------- courses ----------------
    case "create_course": {
      const name = String(a.name ?? "").trim();
      if (!name) return "I need a course name.";
      const c = await coursesDb.create(name);
      inv.courses.push({ id: c.id, name: c.name });
      return `Created the course "${name}".`;
    }
    case "delete_course": {
      const hit = findBest(String(a.name ?? ""), inv.courses, (c) => c.name);
      if (!hit) return `I couldn't find a course called "${a.name}".`;
      await coursesDb.delete(hit.id);
      inv.courses = inv.courses.filter((c) => c.id !== hit.id);
      return `Deleted the course "${hit.name}".`;
    }

    // ---------------- flashcard decks ----------------
    case "create_deck": {
      const title = String(a.title ?? "").trim();
      if (!title) return "I need a title for the deck.";
      const topic = a.topic ? String(a.topic) : title;
      const count = Number.isFinite(a.count) ? Math.min(30, Math.max(4, a.count)) : 12;
      const cards = await generateFlashcards(ctx.aiConfig, topic, count);
      const id = generateId();
      await flashcardDb.save({ id, title, cards, createdAt: new Date() });
      inv.decks.push({ id, title });
      return `Built a ${cards.length}-card deck "${title}".`;
    }
    case "delete_deck": {
      const hit = findBest(String(a.title ?? ""), inv.decks, (d) => d.title);
      if (!hit) return `I couldn't find a deck called "${a.title}".`;
      await flashcardDb.delete(hit.id);
      inv.decks = inv.decks.filter((d) => d.id !== hit.id);
      return `Deleted the deck "${hit.title}".`;
    }

    // ---------------- quizzes ----------------
    case "create_quiz": {
      const title = String(a.title ?? "").trim();
      if (!title) return "I need a title for the quiz.";
      const topic = a.topic ? String(a.topic) : title;
      const count = Number.isFinite(a.count) ? Math.min(20, Math.max(3, a.count)) : 10;
      const questions = await generateQuiz(ctx.aiConfig, topic, count);
      const id = generateId();
      await quizDb.save({ id, title, questions, createdAt: new Date() });
      inv.quizzes.push({ id, title });
      return `Created a ${questions.length}-question quiz "${title}".`;
    }
    case "delete_quiz": {
      const hit = findBest(String(a.title ?? ""), inv.quizzes, (q) => q.title);
      if (!hit) return `I couldn't find a quiz called "${a.title}".`;
      await quizDb.delete(hit.id);
      inv.quizzes = inv.quizzes.filter((q) => q.id !== hit.id);
      return `Deleted the quiz "${hit.title}".`;
    }

    // ---------------- projects ----------------
    case "create_project": {
      const name = String(a.name ?? "").trim();
      if (!name) return "I need a project name.";
      const id = generateId();
      await projectDb.save({
        id,
        name,
        description: String(a.description ?? ""),
        status: ["planning", "in-progress", "completed", "on-hold"].includes(a.status)
          ? a.status
          : "planning",
        techStack: Array.isArray(a.techStack) ? a.techStack.map(String) : [],
        priority: ["low", "medium", "high"].includes(a.priority) ? a.priority : "medium",
        progress: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        tasks: [],
      });
      inv.projects.push({ id, name, tasks: [] });
      return `Created the project "${name}".`;
    }
    case "delete_project": {
      const hit = findBest(String(a.name ?? ""), inv.projects, (p) => p.name);
      if (!hit) return `I couldn't find a project called "${a.name}".`;
      await projectDb.delete(hit.id);
      inv.projects = inv.projects.filter((p) => p.id !== hit.id);
      return `Deleted the project "${hit.name}".`;
    }
    case "add_project_task": {
      const proj = findBest(String(a.project ?? ""), inv.projects, (p) => p.name);
      if (!proj) return `I couldn't find a project called "${a.project}".`;
      const title = String(a.title ?? "").trim();
      if (!title) return "I need a task title.";
      const t = await projectTaskDb.add(proj.id, title);
      proj.tasks.push({ id: t.id, title, done: false });
      return `Added "${title}" to the project "${proj.name}".`;
    }
    case "complete_project_task": {
      const proj = findBest(String(a.project ?? ""), inv.projects, (p) => p.name);
      if (!proj) return `I couldn't find a project called "${a.project}".`;
      const task = findBest(String(a.title ?? ""), proj.tasks, (t) => t.title);
      if (!task) return `I couldn't find "${a.title}" in "${proj.name}".`;
      await projectTaskDb.toggle(task.id, true);
      task.done = true;
      return `Checked off "${task.title}" in "${proj.name}".`;
    }

    // ---------------- navigation ----------------
    case "navigate": {
      const route = ROUTES[String(a.to ?? "").toLowerCase().trim()];
      if (!route) return `I don't know how to open "${a.to}".`;
      ctx.navigate(route);
      return `Opening ${a.to}.`;
    }

    default:
      return `I don't know how to "${a.type}" yet.`;
  }
}

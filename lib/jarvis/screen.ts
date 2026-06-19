/**
 * Maps the current route to a friendly description so Jarvis is aware of what
 * screen the user is looking at ("I see you're on the Quiz page…").
 */

const SCREENS: { match: (p: string) => boolean; name: string; desc: string }[] = [
  { match: (p) => p === "/dashboard", name: "Dashboard", desc: "their home overview with stats, streak, level, and quick actions" },
  { match: (p) => p.startsWith("/coach"), name: "Jarvis / AI Coach", desc: "your own coaching page" },
  { match: (p) => p.startsWith("/achievements"), name: "Progress & Achievements", desc: "XP, levels, streaks, goals, and achievements" },
  { match: (p) => p.startsWith("/chat"), name: "AI Chat", desc: "the AI chat assistant" },
  { match: (p) => p.startsWith("/notes"), name: "Notes Generator", desc: "where they turn material into study notes" },
  { match: (p) => p.startsWith("/quiz"), name: "Quiz Generator", desc: "where they create and take quizzes" },
  { match: (p) => p.startsWith("/exam"), name: "Exam Mode", desc: "timed exam practice" },
  { match: (p) => p.startsWith("/flashcards"), name: "Flashcards", desc: "studying flashcard decks" },
  { match: (p) => p.startsWith("/explain"), name: "Explain Topic", desc: "getting topics explained" },
  { match: (p) => p.startsWith("/planner"), name: "Study Planner", desc: "their tasks and study plans" },
  { match: (p) => p.startsWith("/projects"), name: "Project Manager", desc: "their coding projects" },
  { match: (p) => p.startsWith("/repos"), name: "My Repos", desc: "their GitHub repositories" },
  { match: (p) => p.startsWith("/profile"), name: "Profile", desc: "their account profile" },
  { match: (p) => p.startsWith("/settings"), name: "Settings", desc: "app and API key settings" },
];

export function describeScreen(pathname: string): { name: string; desc: string } {
  const hit = SCREENS.find((s) => s.match(pathname));
  return hit ? { name: hit.name, desc: hit.desc } : { name: "the app", desc: "the StudyPilot app" };
}

import {
  ChatSession,
  Note,
  Quiz,
  QuizResult,
  FlashcardDeck,
  StudySession,
  StudyTask,
  UserSettings,
} from "@/types";

const KEYS = {
  SETTINGS: "studypilot_settings",
  CHAT_SESSIONS: "studypilot_chat_sessions",
  NOTES: "studypilot_notes",
  QUIZZES: "studypilot_quizzes",
  QUIZ_RESULTS: "studypilot_quiz_results",
  FLASHCARD_DECKS: "studypilot_flashcard_decks",
  STUDY_SESSIONS: "studypilot_study_sessions",
  STUDY_TASKS: "studypilot_study_tasks",
} as const;

function getItem<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const item = localStorage.getItem(key);
    if (!item) return fallback;
    return JSON.parse(item) as T;
  } catch {
    return fallback;
  }
}

function setItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    console.error("Failed to save to localStorage");
  }
}

function removeItem(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
}

export const settingsStorage = {
  get: (): UserSettings =>
    getItem<UserSettings>(KEYS.SETTINGS, {
      geminiApiKey: "",
      openaiApiKey: "",
      anthropicApiKey: "",
      groqApiKey: "",
      openrouterApiKey: "",
      aiProvider: "gemini",
      theme: "system",
      defaultDifficulty: "intermediate",
      notificationsEnabled: true,
      dailyGoalMinutes: 60,
      elevenLabsApiKey: "",
      elevenLabsVoiceId: "",
    }),
  set: (settings: UserSettings) => setItem(KEYS.SETTINGS, settings),
  getApiKey: (): string => {
    const s = settingsStorage.get();
    return s.geminiApiKey || "";
  },
};

export const chatStorage = {
  getAll: (): ChatSession[] => getItem<ChatSession[]>(KEYS.CHAT_SESSIONS, []),
  save: (session: ChatSession) => {
    const sessions = chatStorage.getAll();
    const idx = sessions.findIndex((s) => s.id === session.id);
    if (idx >= 0) sessions[idx] = session;
    else sessions.unshift(session);
    setItem(KEYS.CHAT_SESSIONS, sessions.slice(0, 50));
  },
  delete: (id: string) => {
    const sessions = chatStorage.getAll().filter((s) => s.id !== id);
    setItem(KEYS.CHAT_SESSIONS, sessions);
  },
};

export const notesStorage = {
  getAll: (): Note[] => getItem<Note[]>(KEYS.NOTES, []),
  save: (note: Note) => {
    const notes = notesStorage.getAll();
    const idx = notes.findIndex((n) => n.id === note.id);
    if (idx >= 0) notes[idx] = note;
    else notes.unshift(note);
    setItem(KEYS.NOTES, notes);
  },
  delete: (id: string) => {
    const notes = notesStorage.getAll().filter((n) => n.id !== id);
    setItem(KEYS.NOTES, notes);
  },
};

export const quizStorage = {
  getAll: (): Quiz[] => getItem<Quiz[]>(KEYS.QUIZZES, []),
  save: (quiz: Quiz) => {
    const quizzes = quizStorage.getAll();
    const idx = quizzes.findIndex((q) => q.id === quiz.id);
    if (idx >= 0) quizzes[idx] = quiz;
    else quizzes.unshift(quiz);
    setItem(KEYS.QUIZZES, quizzes);
  },
  delete: (id: string) => {
    const quizzes = quizStorage.getAll().filter((q) => q.id !== id);
    setItem(KEYS.QUIZZES, quizzes);
  },
  saveResult: (result: QuizResult) => {
    const results = getItem<QuizResult[]>(KEYS.QUIZ_RESULTS, []);
    results.unshift(result);
    setItem(KEYS.QUIZ_RESULTS, results.slice(0, 100));
  },
  getResults: (): QuizResult[] =>
    getItem<QuizResult[]>(KEYS.QUIZ_RESULTS, []),
};

export const flashcardStorage = {
  getAll: (): FlashcardDeck[] =>
    getItem<FlashcardDeck[]>(KEYS.FLASHCARD_DECKS, []),
  save: (deck: FlashcardDeck) => {
    const decks = flashcardStorage.getAll();
    const idx = decks.findIndex((d) => d.id === deck.id);
    if (idx >= 0) decks[idx] = deck;
    else decks.unshift(deck);
    setItem(KEYS.FLASHCARD_DECKS, decks);
  },
  delete: (id: string) => {
    const decks = flashcardStorage.getAll().filter((d) => d.id !== id);
    setItem(KEYS.FLASHCARD_DECKS, decks);
  },
};

export const sessionStorage2 = {
  getAll: (): StudySession[] =>
    getItem<StudySession[]>(KEYS.STUDY_SESSIONS, []),
  add: (session: StudySession) => {
    const sessions = sessionStorage2.getAll();
    sessions.unshift(session);
    setItem(KEYS.STUDY_SESSIONS, sessions.slice(0, 200));
  },
};

export const taskStorage = {
  getAll: (): StudyTask[] => getItem<StudyTask[]>(KEYS.STUDY_TASKS, []),
  save: (task: StudyTask) => {
    const tasks = taskStorage.getAll();
    const idx = tasks.findIndex((t) => t.id === task.id);
    if (idx >= 0) tasks[idx] = task;
    else tasks.unshift(task);
    setItem(KEYS.STUDY_TASKS, tasks);
  },
  delete: (id: string) => {
    const tasks = taskStorage.getAll().filter((t) => t.id !== id);
    setItem(KEYS.STUDY_TASKS, tasks);
  },
};

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  sourceFile?: string;
  createdAt: Date;
  tags: string[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface Quiz {
  id: string;
  title: string;
  questions: QuizQuestion[];
  sourceContent?: string;
  createdAt: Date;
}

export interface QuizResult {
  quizId: string;
  score: number;
  totalQuestions: number;
  answers: number[];
  completedAt: Date;
}

export interface ExamConfig {
  durationMinutes: number;
  passMark: number; // percentage, 0-100
}

export interface ExamSummary {
  score: number;
  totalQuestions: number;
  percentage: number;
  passed: boolean;
  passMark: number;
  timeTakenSeconds: number;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
}

export interface FlashcardDeck {
  id: string;
  title: string;
  cards: Flashcard[];
  createdAt: Date;
  lastStudied?: Date;
}

export interface StudySession {
  id: string;
  type: "chat" | "notes" | "quiz" | "flashcards" | "explain" | "planner";
  title: string;
  duration?: number;
  score?: number;
  createdAt: Date;
}

export interface StudyTask {
  id: string;
  title: string;
  subject: string;
  dueDate: string;
  priority: "low" | "medium" | "high";
  completed: boolean;
  estimatedMinutes: number;
  notes?: string;
}

export interface StudyGoal {
  id: string;
  title: string;
  targetDate: string;
  progress: number;
  milestones: string[];
}

export interface UserSettings {
  geminiApiKey: string;
  openaiApiKey: string;
  aiProvider: AIProvider;
  theme: "light" | "dark" | "system";
  defaultDifficulty: "beginner" | "intermediate" | "advanced";
  notificationsEnabled: boolean;
  dailyGoalMinutes: number;
}

export interface StudyAnalytics {
  totalSessions: number;
  totalMinutes: number;
  averageScore: number;
  streak: number;
  subjectBreakdown: Record<string, number>;
}

export type ProjectStatus =
  | "planning"
  | "in-progress"
  | "completed"
  | "on-hold";

export interface ProjectTask {
  id: string;
  projectId: string;
  title: string;
  done: boolean;
  createdAt: Date;
}

export interface CodingProject {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  techStack: string[];
  repoUrl?: string;
  liveUrl?: string;
  priority: "low" | "medium" | "high";
  progress: number;
  deadline?: string;
  createdAt: Date;
  updatedAt: Date;
  tasks: ProjectTask[];
}

export type Difficulty = "beginner" | "intermediate" | "advanced";

export type AIProvider = "gemini" | "openai";

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
}

export interface ExplanationRequest {
  topic: string;
  difficulty: Difficulty;
  additionalContext?: string;
}

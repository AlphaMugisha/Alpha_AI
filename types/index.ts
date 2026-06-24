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
  courseId?: string;
  createdAt: Date;
  tags: string[];
}

export interface Course {
  id: string;
  name: string;
  createdAt: Date;
}

export type QuizQuestionType = "mcq" | "open";

export interface QuizQuestion {
  id: string;
  // Absent => "mcq" (back-compat with quizzes saved before open-ended existed).
  type?: QuizQuestionType;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  // Open-ended only: the reference answer used to AI-grade the written response.
  modelAnswer?: string;
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

// ----- Structured (mixed-format) exams -----
export type ExamStrictness = "lenient" | "balanced" | "strict";
export type ExamSection = "A" | "B";
export type ExamQuestionType = "mcq" | "truefalse" | "short";

export interface ExamQuestion {
  id: string;
  section: ExamSection;
  type: ExamQuestionType;
  marks: number;
  question: string;
  options?: string[]; // mcq only
  correctAnswer?: number; // mcq: index of correct option
  correctBool?: boolean; // truefalse: the correct value
  modelAnswer?: string; // short: reference answer for AI grading
  explanation?: string;
}

export interface StructuredExam {
  title: string;
  questions: ExamQuestion[];
}

// A user's answer to one question: option index (mcq), boolean (truefalse),
// or free text (short). null = unanswered.
export type ExamAnswer = number | boolean | string | null;

export interface ExamGrade {
  awarded: number;
  max: number;
  feedback?: string;
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
  anthropicApiKey: string;
  groqApiKey: string;
  openrouterApiKey: string;
  aiProvider: AIProvider;
  theme: "light" | "dark" | "system";
  defaultDifficulty: "beginner" | "intermediate" | "advanced";
  notificationsEnabled: boolean;
  dailyGoalMinutes: number;
  // Jarvis voice (ElevenLabs neural TTS). When the key is empty, Jarvis falls
  // back to the browser's built-in speech synthesis.
  elevenLabsApiKey: string;
  elevenLabsVoiceId: string;
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

export type AIProvider = "gemini" | "openai" | "anthropic" | "groq" | "openrouter";

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
}

export interface ExplanationRequest {
  topic: string;
  difficulty: Difficulty;
  additionalContext?: string;
}

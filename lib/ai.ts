import { AIConfig, QuizQuestion, Flashcard, Difficulty } from "@/types";
import * as gemini from "./gemini";
import * as openaiLib from "./openai";
import { friendlyAIError } from "./aiErrors";

type GeminiHistory = { role: "user" | "model"; parts: { text: string }[] }[];

function toOpenAIMessages(history: GeminiHistory) {
  return history.map((m) => ({
    role: m.role === "model" ? ("assistant" as const) : ("user" as const),
    content: m.parts[0].text,
  }));
}

// Run a provider call and rethrow any failure as a clear, user-facing message.
async function run<T>(provider: AIConfig["provider"], fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw friendlyAIError(err, provider === "openai" ? "openai" : "gemini");
  }
}

export async function generateChatResponse(
  config: AIConfig,
  history: GeminiHistory,
  systemPrompt?: string
): Promise<string> {
  return run(config.provider, () =>
    config.provider === "openai"
      ? openaiLib.generateChatResponse(config.apiKey, toOpenAIMessages(history), systemPrompt)
      : gemini.generateChatResponse(config.apiKey, history, systemPrompt)
  );
}

// JSON-mode generation for structured payloads (exams, grading, etc.).
export async function generateStructured(
  config: AIConfig,
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  return run(config.provider, () =>
    config.provider === "openai"
      ? openaiLib.generateJSON(config.apiKey, prompt, systemPrompt)
      : gemini.generateJSON(config.apiKey, prompt, systemPrompt)
  );
}

export async function generateNotes(
  config: AIConfig,
  content: string,
  title?: string
): Promise<string> {
  return run(config.provider, () =>
    config.provider === "openai"
      ? openaiLib.generateNotes(config.apiKey, content, title)
      : gemini.generateNotes(config.apiKey, content, title)
  );
}

export async function generateQuiz(
  config: AIConfig,
  content: string,
  numQuestions?: number
): Promise<QuizQuestion[]> {
  return run(config.provider, () =>
    config.provider === "openai"
      ? openaiLib.generateQuiz(config.apiKey, content, numQuestions)
      : gemini.generateQuiz(config.apiKey, content, numQuestions)
  );
}

export async function generateFlashcards(
  config: AIConfig,
  content: string,
  numCards?: number
): Promise<Flashcard[]> {
  return run(config.provider, () =>
    config.provider === "openai"
      ? openaiLib.generateFlashcards(config.apiKey, content, numCards)
      : gemini.generateFlashcards(config.apiKey, content, numCards)
  );
}

export async function explainTopic(
  config: AIConfig,
  topic: string,
  difficulty: Difficulty,
  additionalContext?: string
): Promise<string> {
  return run(config.provider, () =>
    config.provider === "openai"
      ? openaiLib.explainTopic(config.apiKey, topic, difficulty, additionalContext)
      : gemini.explainTopic(config.apiKey, topic, difficulty, additionalContext)
  );
}

export async function generateStudyPlan(
  config: AIConfig,
  subject: string,
  goal: string,
  timeAvailable: string,
  currentLevel: string
): Promise<string> {
  return run(config.provider, () =>
    config.provider === "openai"
      ? openaiLib.generateStudyPlan(config.apiKey, subject, goal, timeAvailable, currentLevel)
      : gemini.generateStudyPlan(config.apiKey, subject, goal, timeAvailable, currentLevel)
  );
}

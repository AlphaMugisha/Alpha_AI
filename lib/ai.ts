import { AIConfig, QuizQuestion, Flashcard, Difficulty } from "@/types";
import * as gemini from "./gemini";
import * as openaiLib from "./openai";

type GeminiHistory = { role: "user" | "model"; parts: { text: string }[] }[];

function toOpenAIMessages(history: GeminiHistory) {
  return history.map((m) => ({
    role: m.role === "model" ? ("assistant" as const) : ("user" as const),
    content: m.parts[0].text,
  }));
}

export async function generateChatResponse(
  config: AIConfig,
  history: GeminiHistory,
  systemPrompt?: string
): Promise<string> {
  if (config.provider === "openai") {
    return openaiLib.generateChatResponse(config.apiKey, toOpenAIMessages(history), systemPrompt);
  }
  return gemini.generateChatResponse(config.apiKey, history, systemPrompt);
}

export async function generateNotes(
  config: AIConfig,
  content: string,
  title?: string
): Promise<string> {
  if (config.provider === "openai") {
    return openaiLib.generateNotes(config.apiKey, content, title);
  }
  return gemini.generateNotes(config.apiKey, content, title);
}

export async function generateQuiz(
  config: AIConfig,
  content: string,
  numQuestions?: number
): Promise<QuizQuestion[]> {
  if (config.provider === "openai") {
    return openaiLib.generateQuiz(config.apiKey, content, numQuestions);
  }
  return gemini.generateQuiz(config.apiKey, content, numQuestions);
}

export async function generateFlashcards(
  config: AIConfig,
  content: string,
  numCards?: number
): Promise<Flashcard[]> {
  if (config.provider === "openai") {
    return openaiLib.generateFlashcards(config.apiKey, content, numCards);
  }
  return gemini.generateFlashcards(config.apiKey, content, numCards);
}

export async function explainTopic(
  config: AIConfig,
  topic: string,
  difficulty: Difficulty,
  additionalContext?: string
): Promise<string> {
  if (config.provider === "openai") {
    return openaiLib.explainTopic(config.apiKey, topic, difficulty, additionalContext);
  }
  return gemini.explainTopic(config.apiKey, topic, difficulty, additionalContext);
}

export async function generateStudyPlan(
  config: AIConfig,
  subject: string,
  goal: string,
  timeAvailable: string,
  currentLevel: string
): Promise<string> {
  if (config.provider === "openai") {
    return openaiLib.generateStudyPlan(config.apiKey, subject, goal, timeAvailable, currentLevel);
  }
  return gemini.generateStudyPlan(config.apiKey, subject, goal, timeAvailable, currentLevel);
}

import { AIConfig, QuizQuestion, Flashcard, Difficulty } from "@/types";
import * as gemini from "./gemini";
import * as openaiLib from "./openai";
import * as anthropicLib from "./anthropic";
import * as groqLib from "./groq";
import { friendlyAIError } from "./aiErrors";

type GeminiHistory = { role: "user" | "model"; parts: { text: string }[] }[];

// Both OpenAI and Anthropic use the same {role:"user"|"assistant", content} shape.
function toChatMessages(history: GeminiHistory) {
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
    throw friendlyAIError(err, provider);
  }
}

export type ChatImage = gemini.InlineImage;

export async function generateChatResponse(
  config: AIConfig,
  history: GeminiHistory,
  systemPrompt?: string,
  images?: ChatImage[]
): Promise<string> {
  if (images && images.length > 0) {
    if (config.provider !== "gemini") {
      throw new Error(
        "Image understanding currently needs the Gemini provider. Switch to Gemini in Settings to chat with images."
      );
    }
    return run(config.provider, () =>
      gemini.generateChatResponseMultimodal(config.apiKey, history, images, systemPrompt)
    );
  }
  return run(config.provider, () =>
    config.provider === "openai"
      ? openaiLib.generateChatResponse(config.apiKey, toChatMessages(history), systemPrompt)
      : config.provider === "anthropic"
        ? anthropicLib.generateChatResponse(config.apiKey, toChatMessages(history), systemPrompt)
        : config.provider === "groq"
          ? groqLib.generateChatResponse(config.apiKey, toChatMessages(history), systemPrompt)
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
      : config.provider === "anthropic"
        ? anthropicLib.generateJSON(config.apiKey, prompt, systemPrompt)
        : config.provider === "groq"
          ? groqLib.generateJSON(config.apiKey, prompt, systemPrompt)
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
      : config.provider === "anthropic"
        ? anthropicLib.generateNotes(config.apiKey, content, title)
        : config.provider === "groq"
          ? groqLib.generateNotes(config.apiKey, content, title)
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
      : config.provider === "anthropic"
        ? anthropicLib.generateQuiz(config.apiKey, content, numQuestions)
        : config.provider === "groq"
          ? groqLib.generateQuiz(config.apiKey, content, numQuestions)
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
      : config.provider === "anthropic"
        ? anthropicLib.generateFlashcards(config.apiKey, content, numCards)
        : config.provider === "groq"
          ? groqLib.generateFlashcards(config.apiKey, content, numCards)
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
      : config.provider === "anthropic"
        ? anthropicLib.explainTopic(config.apiKey, topic, difficulty, additionalContext)
        : config.provider === "groq"
          ? groqLib.explainTopic(config.apiKey, topic, difficulty, additionalContext)
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
      : config.provider === "anthropic"
        ? anthropicLib.generateStudyPlan(config.apiKey, subject, goal, timeAvailable, currentLevel)
        : config.provider === "groq"
          ? groqLib.generateStudyPlan(config.apiKey, subject, goal, timeAvailable, currentLevel)
          : gemini.generateStudyPlan(config.apiKey, subject, goal, timeAvailable, currentLevel)
  );
}

import { makeOpenAICompatible } from "./openaiCompatible";

// Groq is OpenAI-compatible and free (no credit card). Llama 3.3 70B is a
// strong, free general model. Users can change the model if Groq rotates it.
export const {
  generateChatResponse,
  generateJSON,
  generateNotes,
  generateQuiz,
  generateFlashcards,
  explainTopic,
  generateStudyPlan,
} = makeOpenAICompatible({
  model: "llama-3.3-70b-versatile",
  baseURL: "https://api.groq.com/openai/v1",
  providerLabel: "Groq",
});

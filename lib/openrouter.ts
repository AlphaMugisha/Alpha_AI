import { makeOpenAICompatible } from "./openaiCompatible";

// OpenRouter is OpenAI-compatible and exposes many models behind a single key,
// including several free ones (suffixed ":free"). Llama 3.3 70B (free) is a
// strong, reliable general/JSON model and a good default. Users can switch the
// model if OpenRouter rotates its free lineup.
export const {
  generateChatResponse,
  generateJSON,
  generateNotes,
  generateQuiz,
  generateFlashcards,
  explainTopic,
  generateStudyPlan,
} = makeOpenAICompatible({
  model: "meta-llama/llama-3.3-70b-instruct:free",
  baseURL: "https://openrouter.ai/api/v1",
  providerLabel: "OpenRouter",
});

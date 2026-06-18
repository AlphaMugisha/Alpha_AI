import Anthropic from "@anthropic-ai/sdk";
import { QuizQuestion, Flashcard, Difficulty } from "@/types";

// Anthropic's most capable model. The user can change this later if desired.
const MODEL = "claude-opus-4-8";
const MAX_TOKENS = 16000;

function getClient(apiKey: string) {
  if (!apiKey)
    throw new Error("No Anthropic API key provided. Please add it in Settings.");
  // This app calls the provider directly from the browser with the user's own key.
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

function textOf(blocks: Anthropic.ContentBlock[]): string {
  return blocks.map((b) => (b.type === "text" ? b.text : "")).join("");
}

async function complete(
  apiKey: string,
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  const client = getClient(apiKey);
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages: [{ role: "user", content: prompt }],
  });
  return textOf(res.content);
}

export async function generateChatResponse(
  apiKey: string,
  messages: { role: "user" | "assistant"; content: string }[],
  systemPrompt?: string
): Promise<string> {
  const client = getClient(apiKey);
  const system =
    systemPrompt ||
    "You are Alpha, an intelligent study assistant. Help students learn effectively with clear explanations, examples, and encouragement. Format responses with markdown for readability.";
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system,
    messages,
  });
  return textOf(res.content);
}

export async function generateNotes(
  apiKey: string,
  content: string,
  title?: string
): Promise<string> {
  const prompt = `You are an expert study-notes creator. Read the source material below and produce CONCISE, well-organized summary notes that distill the key ideas in your own words.

${title ? `Title: ${title}\n` : ""}Source material:
${content.slice(0, 15000)}

CRITICAL:
- SUMMARIZE — do not copy or restate the source verbatim or reproduce it line by line.
- Condense to roughly 25-40% of the original length, keeping only what matters for revision.
- Rephrase ideas clearly and simply; cut filler, repetition, and examples that don't add understanding.

Format with Markdown so it's easy to skim and study:
- A single \`#\` title at the top
- \`##\` headings grouping related ideas, with \`###\` subsections where helpful
- **Bold** for key terms and definitions
- Bullet points for lists of facts, steps, or properties
- \`>\` blockquotes for crucial definitions, rules, or formulas
- End with a \`## Key Takeaways\` section of 3-6 bullet points

Output ONLY the Markdown notes, nothing else.`;
  return complete(apiKey, prompt);
}

export async function generateQuiz(
  apiKey: string,
  content: string,
  numQuestions: number = 10
): Promise<QuizQuestion[]> {
  const prompt = `Create ${numQuestions} multiple choice quiz questions from the following content.

Content:
${content.slice(0, 12000)}

Return ONLY a valid JSON array with this exact structure, no markdown, no explanation:
[
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation": "Brief explanation of why this is correct"
  }
]

correctAnswer is the index (0-3) of the correct option.
Make questions diverse, covering different aspects of the content.`;
  const text = await complete(apiKey, prompt);
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array found");
    const questions = JSON.parse(jsonMatch[0]) as QuizQuestion[];
    return questions.map((q, i) => ({ ...q, id: `q_${i}_${Date.now()}` }));
  } catch {
    throw new Error("Failed to parse quiz questions. Please try again.");
  }
}

export async function generateFlashcards(
  apiKey: string,
  content: string,
  numCards: number = 15
): Promise<Flashcard[]> {
  const prompt = `Create ${numCards} flashcards from the following content.

Content:
${content.slice(0, 12000)}

Return ONLY a valid JSON array, no markdown, no explanation:
[
  { "front": "Term or question", "back": "Definition or answer" }
]

Make flashcards concise and focused on key concepts, definitions, and important facts.`;
  const text = await complete(apiKey, prompt);
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array found");
    const cards = JSON.parse(jsonMatch[0]) as Omit<Flashcard, "id">[];
    return cards.map((c, i) => ({ ...c, id: `card_${i}_${Date.now()}` }));
  } catch {
    throw new Error("Failed to parse flashcards. Please try again.");
  }
}

export async function explainTopic(
  apiKey: string,
  topic: string,
  difficulty: Difficulty,
  additionalContext?: string
): Promise<string> {
  const difficultyGuide = {
    beginner:
      "Use very simple language, real-world analogies, and avoid jargon. Explain as if talking to a 12-year-old.",
    intermediate:
      "Use clear language with some technical terms explained. Include examples and practical applications.",
    advanced:
      "Use technical terminology, discuss nuances, edge cases, and deeper concepts. Include comparisons and advanced examples.",
  };
  const prompt = `Explain the following topic at a ${difficulty} level.

Topic: ${topic}
${additionalContext ? `Additional context: ${additionalContext}` : ""}

Guidelines: ${difficultyGuide[difficulty]}

Structure your explanation with:
1. **Overview** - What is it and why does it matter?
2. **Core Concepts** - The fundamental ideas
3. **Examples** - Concrete illustrations
4. **Key Points** - What to remember

Use markdown formatting for clarity.`;
  return complete(apiKey, prompt);
}

export async function generateStudyPlan(
  apiKey: string,
  subject: string,
  goal: string,
  timeAvailable: string,
  currentLevel: string
): Promise<string> {
  const prompt = `Create a detailed study plan for the following:

Subject: ${subject}
Goal: ${goal}
Time Available: ${timeAvailable}
Current Level: ${currentLevel}

Create a structured study plan with a schedule breakdown, ordered topics, recommended techniques, progress checkpoints, time estimates, and subject-specific tips. Format clearly with markdown. Be specific and actionable.`;
  return complete(apiKey, prompt);
}

/** JSON-mode generation — instructs JSON-only output; callers parse leniently. */
export async function generateJSON(
  apiKey: string,
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  const system =
    (systemPrompt ? systemPrompt + " " : "") +
    "Respond with ONLY the requested JSON. No preamble, no explanation, no markdown fences.";
  const text = await complete(apiKey, prompt, system);
  if (!text || !text.trim()) {
    throw new Error("The model returned an empty response. Please try again.");
  }
  return text;
}

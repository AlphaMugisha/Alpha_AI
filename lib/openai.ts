import OpenAI from "openai";
import { QuizQuestion, Flashcard, Difficulty } from "@/types";

const MODEL = "gpt-4o-mini";

function getClient(apiKey: string) {
  if (!apiKey) throw new Error("No OpenAI API key provided. Please add it in Settings.");
  return new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
}

export async function generateChatResponse(
  apiKey: string,
  messages: { role: "user" | "assistant"; content: string }[],
  systemPrompt?: string
): Promise<string> {
  const client = getClient(apiKey);
  const systemMsg = systemPrompt ||
    "You are Alpha, an intelligent study assistant. Help students learn effectively with clear explanations, examples, and encouragement. Format responses with markdown for readability.";

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemMsg },
      ...messages,
    ],
  });
  return response.choices[0].message.content ?? "";
}

/** JSON-mode generation — returns a clean JSON string. */
export async function generateJSON(
  apiKey: string,
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  const client = getClient(apiKey);
  const response = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: "json_object" },
    messages: [
      ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
      { role: "user", content: prompt },
    ],
  });
  return response.choices[0].message.content ?? "";
}

export async function generateNotes(
  apiKey: string,
  content: string,
  title?: string
): Promise<string> {
  const client = getClient(apiKey);
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

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
  });
  return response.choices[0].message.content ?? "";
}

export async function generateQuiz(
  apiKey: string,
  content: string,
  numQuestions: number = 10
): Promise<QuizQuestion[]> {
  const client = getClient(apiKey);
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

correctAnswer is the index (0-3) of the correct option.`;

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const text = response.choices[0].message.content ?? "{}";
  try {
    const parsed = JSON.parse(text);
    const questions: QuizQuestion[] = Array.isArray(parsed) ? parsed : parsed.questions ?? [];
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
  const client = getClient(apiKey);
  const prompt = `Create ${numCards} flashcards from the following content.

Content:
${content.slice(0, 12000)}

Return ONLY a valid JSON object with a "cards" array, no markdown:
{"cards": [{"front": "Term or question", "back": "Definition or answer"}]}

Make flashcards concise and focused on key concepts, definitions, and important facts.`;

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const text = response.choices[0].message.content ?? "{}";
  try {
    const parsed = JSON.parse(text);
    const cards: Omit<Flashcard, "id">[] = parsed.cards ?? parsed ?? [];
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
  const client = getClient(apiKey);
  const difficultyGuide = {
    beginner: "Use very simple language, real-world analogies, and avoid jargon. Explain as if talking to a 12-year-old.",
    intermediate: "Use clear language with some technical terms explained. Include examples and practical applications.",
    advanced: "Use technical terminology, discuss nuances, edge cases, and deeper concepts. Include comparisons and advanced examples.",
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
${difficulty === "advanced" ? "5. **Advanced Insights** - Deeper nuances and edge cases" : ""}
${difficulty === "beginner" ? "5. **Analogy** - A simple real-world comparison" : ""}

Use markdown formatting for clarity.`;

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
  });
  return response.choices[0].message.content ?? "";
}

export async function generateStudyPlan(
  apiKey: string,
  subject: string,
  goal: string,
  timeAvailable: string,
  currentLevel: string
): Promise<string> {
  const client = getClient(apiKey);
  const prompt = `Create a detailed study plan for the following:

Subject: ${subject}
Goal: ${goal}
Time Available: ${timeAvailable}
Current Level: ${currentLevel}

Create a structured study plan with:
- Daily/weekly schedule breakdown
- Specific topics to cover in order
- Recommended resources and study techniques
- Progress checkpoints
- Time estimates for each section
- Tips for this subject

Format clearly with markdown. Be specific and actionable.`;

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
  });
  return response.choices[0].message.content ?? "";
}

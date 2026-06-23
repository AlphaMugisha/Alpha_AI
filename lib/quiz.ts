import { AIConfig, QuizQuestion } from "@/types";
import { generateStructured, generateChatResponse } from "./ai";
import { generateId } from "./utils";

const isOpenQ = (q: QuizQuestion) => (q.type ?? "mcq") === "open";

/** A short nudge toward the answer WITHOUT revealing it. */
export async function getQuizHint(
  config: AIConfig,
  q: QuizQuestion
): Promise<string> {
  const system =
    "You are a helpful tutor. Give ONE short hint (1-2 sentences) that nudges " +
    "the student toward the answer. NEVER state or reveal the correct answer.";
  const optionsText = q.options?.length
    ? `\nOptions:\n${q.options
        .map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`)
        .join("\n")}`
    : "";
  const prompt = `Give a hint for this question — do NOT reveal which option/answer is correct.\n\nQuestion: ${q.question}${optionsText}`;
  return generateChatResponse(
    config,
    [{ role: "user", parts: [{ text: prompt }] }],
    system
  );
}

/**
 * Discuss a single question with the student (e.g. they disagree with the
 * marked answer). The AI is given the full answer key and the running
 * conversation; it should fairly concede valid points or explain otherwise.
 */
export async function askAboutQuestion(
  config: AIConfig,
  q: QuizQuestion,
  conversation: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  const open = isOpenQ(q);
  const answerInfo = open
    ? `Model answer: ${q.modelAnswer || "(none provided)"}`
    : `Correct option: ${
        q.options[q.correctAnswer] ?? "(unknown)"
      } (option ${String.fromCharCode(65 + q.correctAnswer)})`;
  const optionsText = q.options?.length
    ? `Options: ${q.options
        .map((o, i) => `(${String.fromCharCode(65 + i)}) ${o}`)
        .join("; ")}\n`
    : "";

  const system = `You are a friendly, fair tutor discussing ONE quiz question with a student who may disagree with the marked answer.

Question: ${q.question}
${optionsText}${answerInfo}
Explanation: ${q.explanation || "(none)"}

If the student makes a valid point, acknowledge it honestly; if their reasoning is wrong, explain clearly and kindly why. Keep replies concise (2-4 sentences). Use markdown.`;

  const history = conversation.map((m) => ({
    role: m.role === "user" ? ("user" as const) : ("model" as const),
    parts: [{ text: m.content }],
  }));
  return generateChatResponse(config, history, system);
}

/**
 * Flexible quiz generation: unlike the fixed exam blueprint, the AI decides how
 * many questions and the blend of types. It produces a natural MIX of:
 *   - "mcq":  4 options, one correct (correctAnswer = 0-based index)
 *   - "open": open-ended / short-answer with a reference modelAnswer
 *
 * Provider-agnostic — routes through generateStructured (JSON mode), so it works
 * for Gemini, OpenAI, Anthropic and Groq without touching the provider libs.
 */

interface RawQuizQ {
  type?: string;
  question?: string;
  options?: string[];
  correctAnswer?: number;
  modelAnswer?: string;
  explanation?: string;
}

function parseLoose<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    /* fall through */
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : (text.match(/\{[\s\S]*\}/)?.[0] ?? "");
  if (!candidate) throw new Error("No JSON found in response");
  try {
    return JSON.parse(candidate) as T;
  } catch {
    const lastBrace = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
    if (lastBrace > 0) return JSON.parse(candidate.slice(0, lastBrace + 1)) as T;
    throw new Error("Unparseable JSON");
  }
}

export interface QuizGenOptions {
  /** Desired number of questions. Omit to let the AI decide (~6-12). */
  count?: number;
  /** Optional free-form instructions from the student (how to build the quiz). */
  instructions?: string;
  /**
   * "generate" (default): write fresh questions from the material.
   * "practice": the document already CONTAINS questions — extract them faithfully
   * and turn them into a practice quiz (detecting MCQ vs open-ended per question).
   */
  mode?: "generate" | "practice";
}

export async function generateMixedQuiz(
  config: AIConfig,
  content: string,
  options: QuizGenOptions = {}
): Promise<QuizQuestion[]> {
  const { count, instructions, mode = "generate" } = options;

  const system =
    "You are an expert quiz writer. You write fair questions grounded STRICTLY " +
    "in the material provided. Output ONLY valid JSON.";

  const typeGuide = `Each question is one of two types:
  - "mcq": multiple choice with EXACTLY 4 options and one correct answer ("correctAnswer" = 0-based index).
  - "open": an open-ended / short-answer question needing a written response; provide a concise "modelAnswer" used to grade it.`;

  let task: string;
  if (mode === "practice") {
    task = `The material below IS a set of questions (e.g. a past paper or list of practice questions). Do NOT invent new topics — EXTRACT the questions that are actually present and turn them into a practice quiz.
For EACH question you find:
  - Detect its type: "mcq" if it offers answer choices, otherwise "open".
  - For "mcq", include its options (pad/trim to EXACTLY 4 sensible options) and set "correctAnswer" — use the answer key in the document if one is given, otherwise work out the correct option yourself.
  - For "open", write a concise correct "modelAnswer".
  - Keep the original wording of each question as faithfully as possible.
Extract EVERY question you can find${count ? `, up to ${count}` : ""}.`;
  } else {
    task = `Create a quiz from the study material below.
${
  count
    ? `Create EXACTLY ${count} questions.`
    : `YOU decide the number of questions (aim for roughly 6-12).`
}
Produce a natural MIX of BOTH types, varying difficulty and ordering as best fits the material. Every question MUST be answerable from the material — no outside facts.`;
  }

  const extra = instructions?.trim()
    ? `\n\nIMPORTANT — extra instructions from the student, follow them closely:\n${instructions.trim()}`
    : "";

  const prompt = `${task}

${typeGuide}${extra}

Return ONLY JSON in EXACTLY this shape:
{
  "questions": [
    { "type": "mcq", "question": "…?", "options": ["A","B","C","D"], "correctAnswer": 0, "explanation": "why correct" },
    { "type": "open", "question": "…?", "modelAnswer": "expected answer", "explanation": "what earns marks" }
  ]
}

Material:
${content.slice(0, 16000)}`;

  const text = await generateStructured(config, prompt, system);

  let raw: { questions?: RawQuizQ[] };
  try {
    raw = parseLoose<{ questions?: RawQuizQ[] }>(text);
  } catch {
    if (typeof console !== "undefined") {
      console.error("Quiz JSON parse failed. Raw model response:\n", text);
    }
    throw new Error("Failed to parse the quiz. Please try again.");
  }

  const questions = (raw.questions ?? [])
    .map((q, i): QuizQuestion => {
      const isOpen =
        q.type === "open" || (!q.options?.length && q.modelAnswer !== undefined);
      if (isOpen) {
        return {
          id: `q_${i}_${generateId()}`,
          type: "open",
          question: q.question ?? "",
          options: [],
          correctAnswer: -1,
          modelAnswer: q.modelAnswer ?? "",
          explanation: q.explanation ?? "",
        };
      }
      return {
        id: `q_${i}_${generateId()}`,
        type: "mcq",
        question: q.question ?? "",
        options: q.options ?? [],
        correctAnswer: typeof q.correctAnswer === "number" ? q.correctAnswer : 0,
        explanation: q.explanation ?? "",
      };
    })
    .filter((q) => q.question.trim().length > 0);

  if (questions.length === 0) {
    throw new Error("The quiz came back empty. Please try again.");
  }
  return questions;
}

import { AIConfig, ExamQuestion, ExamStrictness } from "@/types";
import { generateStructured } from "./ai";
import { generateId } from "./utils";

const STRICTNESS_GUIDE: Record<ExamStrictness, string> = {
  lenient:
    "Grade GENEROUSLY: reward partial understanding and correct ideas even if the wording or syntax is imperfect. Give the benefit of the doubt.",
  balanced:
    "Grade FAIRLY and consistently: award partial marks for partially correct answers; require the key points for full marks.",
  strict:
    "Grade RIGOROUSLY: require precise, complete, correct answers. Deduct for missing key points, errors, or vague wording. Award full marks only for fully correct answers.",
};

/**
 * Structured exam generation + grading.
 *
 * The exam follows a fixed blueprint (kept constant across courses):
 *   Section A — 10 questions, 2 marks each: a mix of MCQ and True/False.
 *   Section A — 20 questions, 2 marks each  → 40 marks  (MCQ + True/False)
 *   Section B —  4 questions, 10 marks each → answer ANY 2 → 20 marks
 *   Raw total 60, converted to a percentage out of 100.
 *
 * Provider-agnostic: everything routes through generateChatResponse so it
 * works for both Gemini and OpenAI without touching the provider libs.
 */

const SECTION_A_COUNT = 20;
const SECTION_A_MARKS = 2;
const SECTION_B_COUNT = 4;
const SECTION_B_MARKS = 10;

function extractJson(text: string): string {
  // Prefer a fenced block, otherwise the outermost {...} object.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const obj = text.match(/\{[\s\S]*\}/);
  if (obj) return obj[0];
  throw new Error("No JSON found in response");
}

// Tolerant parse: JSON mode usually returns clean JSON, but fall back to
// extracting/repairing if the model wrapped or lightly truncated it.
function parseJsonLoose<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    /* try extraction below */
  }
  const candidate = extractJson(text);
  try {
    return JSON.parse(candidate) as T;
  } catch {
    // Last resort: trim to the last complete object/array close and retry.
    const lastBrace = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
    if (lastBrace > 0) {
      return JSON.parse(candidate.slice(0, lastBrace + 1)) as T;
    }
    throw new Error("Unparseable JSON");
  }
}

function ask(config: AIConfig, prompt: string, systemPrompt: string) {
  return generateStructured(config, prompt, systemPrompt);
}

interface RawExam {
  sectionA?: Array<{
    type?: string;
    question?: string;
    options?: string[];
    correctAnswer?: number;
    correctBool?: boolean;
    explanation?: string;
  }>;
  sectionB?: Array<{
    question?: string;
    modelAnswer?: string;
    explanation?: string;
  }>;
}

export async function generateExam(
  config: AIConfig,
  content: string,
  courseName?: string
): Promise<ExamQuestion[]> {
  const system =
    "You are an experienced examiner. You write fair, unambiguous exam papers " +
    "strictly grounded in the study material provided. Output ONLY valid JSON.";

  const prompt = `You are setting a real exam paper${
    courseName ? ` for the course "${courseName}"` : ""
  }, grounded STRICTLY in the study material below. Mirror the style of a typical written exam.

Section A — EXACTLY ${SECTION_A_COUNT} questions, ${SECTION_A_MARKS} marks each (${SECTION_A_COUNT * SECTION_A_MARKS} marks total). Mix these two types:
  - "mcq": multiple choice with EXACTLY 4 options and one correct answer. Make many of them
    scenario-based — a named student faces a real situation, then a question (e.g.
    "Daniel is building a registration form… Which statement about X is correct?").
  - "truefalse": a single clear statement the student must judge True or False.
  Decide the blend yourself; aim for a realistic mix.

Section B — EXACTLY ${SECTION_B_COUNT} questions, ${SECTION_B_MARKS} marks each, all type "short".
  The student will answer ANY 2 of these ${SECTION_B_COUNT} (only their best 2 count, for 20 marks),
  so make all ${SECTION_B_COUNT} substantial, independent, and of comparable difficulty.
  - Practical applied tasks: write code, complete a snippet, define something, or compare/explain.
  - Frame each with a brief real-world scenario and a clear instruction
    (e.g. "Mutoni needs a DELETE endpoint that removes a student by id. Write the route.").
  - Give a concise, correct model answer for each (used to grade the student).

Rules:
  - Every question MUST be answerable from the material — no outside facts.
  - "correctAnswer" is the 0-based index (0-3) of the correct option.
  - Keep questions clear and unambiguous.

IMPORTANT — produce a FRESH paper (variation seed: ${Math.random()
    .toString(36)
    .slice(2)}-${Date.now()}): this is a new attempt, so write DIFFERENT questions
than you would otherwise — vary the wording, the scenarios, the named people, the
order, and which specific concepts you test. Do not reuse a standard set.

Return ONLY JSON in EXACTLY this shape:
{
  "sectionA": [
    { "type": "mcq", "question": "…?", "options": ["A","B","C","D"], "correctAnswer": 0, "explanation": "why correct" },
    { "type": "truefalse", "question": "statement to judge", "correctBool": true, "explanation": "why" }
  ],
  "sectionB": [
    { "question": "scenario + instruction", "modelAnswer": "expected answer", "explanation": "what earns marks" }
  ]
}

Study material:
${content.slice(0, 16000)}`;

  const text = await ask(config, prompt, system);

  let raw: RawExam;
  try {
    raw = parseJsonLoose<RawExam>(text);
  } catch {
    // Surface the raw response in the console to make diagnosis possible.
    if (typeof console !== "undefined") {
      console.error("Exam JSON parse failed. Raw model response:\n", text);
    }
    throw new Error("Failed to parse the exam. Please try again.");
  }

  const sectionA = (raw.sectionA ?? [])
    .slice(0, SECTION_A_COUNT)
    .map((q, i): ExamQuestion => {
      const isTF = q.type === "truefalse" || (!q.options && q.correctBool !== undefined);
      return {
        id: `a_${i}_${generateId()}`,
        section: "A",
        type: isTF ? "truefalse" : "mcq",
        marks: SECTION_A_MARKS,
        question: q.question ?? "",
        options: isTF ? undefined : q.options ?? [],
        correctAnswer: isTF ? undefined : q.correctAnswer ?? 0,
        correctBool: isTF ? Boolean(q.correctBool) : undefined,
        explanation: q.explanation,
      };
    });

  const sectionB = (raw.sectionB ?? [])
    .slice(0, SECTION_B_COUNT)
    .map((q, i): ExamQuestion => ({
      id: `b_${i}_${generateId()}`,
      section: "B",
      type: "short",
      marks: SECTION_B_MARKS,
      question: q.question ?? "",
      modelAnswer: q.modelAnswer,
      explanation: q.explanation,
    }));

  const questions = [...sectionA, ...sectionB];
  if (questions.length === 0) {
    throw new Error("The exam came back empty. Please try again.");
  }
  return questions;
}

export interface ShortGradeInput {
  question: string;
  modelAnswer?: string;
  marks: number;
  answer: string;
}

export interface ShortGradeResult {
  awarded: number;
  feedback: string;
}

/**
 * AI-grades Section B written answers in one batched request.
 * Returns one result per input, in order.
 */
export async function gradeShortAnswers(
  config: AIConfig,
  items: ShortGradeInput[],
  strictness: ExamStrictness = "balanced"
): Promise<ShortGradeResult[]> {
  if (items.length === 0) return [];

  const system =
    "You are an exam grader. Award partial marks. Output ONLY valid JSON.";

  const payload = items
    .map(
      (it, i) => `Q${i + 1} (max ${it.marks} marks):
Question: ${it.question}
Model answer: ${it.modelAnswer ?? "(use your judgement)"}
Student answer: ${it.answer.trim() || "(left blank)"}`
    )
    .join("\n\n");

  const prompt = `Grade each student answer against the question and model answer.
Grading strictness — ${STRICTNESS_GUIDE[strictness]}
Award between 0 and the max marks (decimals allowed). Give one short sentence of feedback.

Return ONLY a JSON array, one object per question in order:
{"grades":[{"awarded": 0, "feedback": "…"}]}

${payload}`;

  const text = await ask(config, prompt, system);
  try {
    const parsed = parseJsonLoose<{ grades?: ShortGradeResult[] }>(text);
    const grades = parsed.grades ?? [];
    return items.map((it, i) => {
      const g = grades[i];
      const awarded = Math.max(0, Math.min(it.marks, Number(g?.awarded ?? 0)));
      return { awarded, feedback: g?.feedback ?? "No feedback." };
    });
  } catch {
    // Grading failed — don't lose the exam; mark written answers as ungraded 0.
    return items.map(() => ({
      awarded: 0,
      feedback: "Could not auto-grade this answer.",
    }));
  }
}

/**
 * Re-grades a single answer when the student "claims" (appeals). The mark may
 * go up, down, or stay the same after an independent second look.
 */
export async function reviewAnswer(
  config: AIConfig,
  item: ShortGradeInput & { previous: number },
  strictness: ExamStrictness = "balanced"
): Promise<ShortGradeResult> {
  const system =
    "You are an exam grader handling a student's appeal. Re-read the answer " +
    "carefully and award the fair mark — it may be higher, lower, or unchanged. " +
    "Output ONLY valid JSON.";

  const prompt = `A student is appealing their grade. Independently re-grade this answer.
Grading strictness — ${STRICTNESS_GUIDE[strictness]}
Max marks: ${item.marks}
Previously awarded: ${item.previous}

Question: ${item.question}
Model answer: ${item.modelAnswer ?? "(use your judgement)"}
Student answer: ${item.answer.trim() || "(left blank)"}

Return ONLY: {"awarded": number, "feedback": "one sentence justifying the decision"}`;

  const text = await ask(config, prompt, system);
  try {
    const g = parseJsonLoose<ShortGradeResult>(text);
    const awarded = Math.max(0, Math.min(item.marks, Number(g?.awarded ?? item.previous)));
    return { awarded, feedback: g?.feedback ?? "Reviewed." };
  } catch {
    return { awarded: item.previous, feedback: "Could not review this answer." };
  }
}

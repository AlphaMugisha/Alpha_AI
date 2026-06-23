import { AIConfig } from "@/types";
import { generateChatResponse } from "./ai";

/**
 * Walk through an uploaded question-and-answer paper, answering it question by
 * question — grounded in the student's OWN notes for that course, and kept
 * deliberately simple so a beginner can follow. Returns Markdown (saved as a note).
 */
export async function answerQuestionPaper(
  config: AIConfig,
  paperContent: string,
  courseName: string | undefined,
  courseNotes: string,
  instructions?: string
): Promise<string> {
  const system = `You are a patient, encouraging tutor helping a student work through a question-and-answer paper, grounded in THEIR OWN course notes.

For EVERY question in the paper, do THREE things in order:
1. **Topic link** — one short line connecting it to the course, e.g. "This is about **<topic>** that we covered in this course…", naming the relevant topic from the notes.
2. **Explanation** — explain SIMPLY and beginner-friendly: short sentences, plain everyday words, tiny examples, so the student truly understands. Avoid jargon; if a technical term is unavoidable, explain it in brackets.
3. **Exam answer** — finish with the concise, exam-ready answer the student should actually WRITE in the exam: clean and to the point, no fluff.

Ground your answers in the course notes provided wherever relevant. If the notes don't cover something, answer from general knowledge but briefly say so. Be warm.

Format as Markdown:
- A single \`#\` title at the top.
- A \`## Question N\` heading per question (quote or paraphrase the question).
- Under each: the topic line, then the explanation, then a \`> **✍️ Exam answer:**\` blockquote with the concise exam answer.`;

  const notesBlock = courseNotes.trim()
    ? `Course notes (your source of truth)${
        courseName ? ` for "${courseName}"` : ""
      }:\n${courseNotes.slice(0, 12000)}`
    : "(No course notes are available yet — answer from the paper and general knowledge, keeping it simple.)";

  const extra = instructions?.trim()
    ? `\n\nExtra instructions from the student — follow these closely:\n${instructions.trim()}`
    : "";

  const prompt = `Here is the question paper to work through, question by question:

--- QUESTION PAPER ---
${paperContent.slice(0, 12000)}
--- END PAPER ---

${notesBlock}${extra}

Now walk through EVERY question in order using the format described. Keep it simple, clear, and grounded in the course notes.`;

  return generateChatResponse(
    config,
    [{ role: "user", parts: [{ text: prompt }] }],
    system
  );
}

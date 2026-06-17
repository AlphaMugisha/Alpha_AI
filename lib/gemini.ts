import { GoogleGenerativeAI } from "@google/generative-ai";
import { QuizQuestion, Flashcard, Difficulty } from "@/types";

function getClient(apiKey: string) {
  if (!apiKey) throw new Error("No API key provided. Please add your Gemini API key in Settings.");
  return new GoogleGenerativeAI(apiKey);
}

export async function generateChatResponse(
  apiKey: string,
  messages: { role: "user" | "model"; parts: { text: string }[] }[],
  systemPrompt?: string
): Promise<string> {
  const genAI = getClient(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction:
      systemPrompt ||
      "You are Alpha, an intelligent study assistant. Help students learn effectively with clear explanations, examples, and encouragement. Format responses with markdown for readability.",
  });

  const chat = model.startChat({ history: messages.slice(0, -1) });
  const lastMessage = messages[messages.length - 1];
  const result = await chat.sendMessage(lastMessage.parts[0].text);
  return result.response.text();
}

export async function generateNotes(
  apiKey: string,
  content: string,
  title?: string
): Promise<string> {
  const genAI = getClient(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `You are an expert study note creator. Create comprehensive, well-structured study notes from the following content.

${title ? `Title: ${title}\n` : ""}
Content:
${content.slice(0, 15000)}

Format the notes with:
- Clear headings and subheadings (use ## and ###)
- Key concepts highlighted with **bold**
- Bullet points for lists
- Important formulas or definitions in blockquotes (> )
- A summary section at the end
- Key takeaways

Make the notes detailed, educational, and easy to study from.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function generateQuiz(
  apiKey: string,
  content: string,
  numQuestions: number = 10
): Promise<QuizQuestion[]> {
  const genAI = getClient(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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

  const result = await model.generateContent(prompt);
  const text = result.response.text();

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
  const genAI = getClient(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `Create ${numCards} flashcards from the following content.

Content:
${content.slice(0, 12000)}

Return ONLY a valid JSON array, no markdown, no explanation:
[
  {
    "front": "Term or question",
    "back": "Definition or answer"
  }
]

Make flashcards concise and focused on key concepts, definitions, and important facts.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

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
  const genAI = getClient(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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
${difficulty === "advanced" ? "5. **Advanced Insights** - Deeper nuances and edge cases" : ""}
${difficulty === "beginner" ? "5. **Analogy** - A simple real-world comparison" : ""}

Use markdown formatting for clarity.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function generateStudyPlan(
  apiKey: string,
  subject: string,
  goal: string,
  timeAvailable: string,
  currentLevel: string
): Promise<string> {
  const genAI = getClient(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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

  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function generateAIInsights(
  apiKey: string,
  sessionData: string
): Promise<string> {
  const genAI = getClient(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `Based on this student's study data, provide 3 brief, personalized AI insights and recommendations:

${sessionData}

Give exactly 3 insights in JSON format:
[
  {"title": "Insight title", "description": "Brief actionable insight", "icon": "trend|target|clock"}
]

Be encouraging, specific, and actionable. Keep each description under 100 characters.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) return jsonMatch[0];
  } catch {
    // ignore
  }
  return JSON.stringify([
    { title: "Keep Going!", description: "You're building great study habits.", icon: "trend" },
    { title: "Set Goals", description: "Define clear daily study targets.", icon: "target" },
    { title: "Take Breaks", description: "Use the Pomodoro technique for focus.", icon: "clock" },
  ]);
}

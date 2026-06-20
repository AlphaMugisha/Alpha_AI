"use client";

import { useState, useRef, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "framer-motion";
import { useSettings } from "@/hooks/useSettings";
import { useStudyData } from "@/hooks/useStudyData";
import { useJarvisRefresh } from "@/hooks/useJarvisRefresh";
import { generateQuiz } from "@/lib/ai";
import { parseFile, validateFile } from "@/lib/fileParser";
import { quizDb, notesDb } from "@/lib/db";
import { generateId, formatDate, formatFileSize } from "@/lib/utils";
import { Quiz, QuizQuestion, QuizResult } from "@/types";
import { toast } from "sonner";
import {
  Brain,
  Upload,
  Loader2,
  Check,
  X,
  Trophy,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  Clock,
  Target,
  Trash2,
  Plus,
  File,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageHeader } from "@/components/shared/PageHeader";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type QuizMode = "setup" | "taking" | "results";

export default function QuizPage() {
  const { aiConfig, hasApiKey } = useSettings();
  const { addSession } = useStudyData();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [mode, setMode] = useState<QuizMode>("setup");
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<(number | null)[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [numQuestions, setNumQuestions] = useState("10");
  const [inputContent, setInputContent] = useState("");
  const [uploadedFile, setUploadedFile] = useState<{ name: string; content: string } | null>(null);
  const [prefilling, setPrefilling] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const autoNoteRef = useRef(false);
  const quizStartRef = useRef(0);

  const refreshQuizzes = async () => {
    setQuizzes(await quizDb.getAll());
  };

  useEffect(() => {
    refreshQuizzes().catch(() => {});
  }, []);

  useJarvisRefresh(() => refreshQuizzes().catch(() => {}));

  // Deep link from a note: /quiz?note=<id> — auto-build a quiz from that lesson and start it.
  useEffect(() => {
    if (autoNoteRef.current) return;
    const noteId = new URLSearchParams(window.location.search).get("note");
    if (!noteId || !hasApiKey) return;
    autoNoteRef.current = true;
    (async () => {
      setPrefilling(true);
      try {
        const all = await notesDb.getAll();
        const note = all.find((n) => n.id === noteId);
        if (!note) {
          toast.error("Lesson not found.");
          return;
        }
        const questions = await generateQuiz(aiConfig, note.content, 10);
        const quiz: Quiz = {
          id: generateId(),
          title: note.title,
          questions,
          sourceContent: note.content.slice(0, 500),
          createdAt: new Date(),
        };
        await quizDb.save(quiz);
        await refreshQuizzes();
        startQuiz(quiz);
        addSession("quiz", quiz.title);
        toast.success(`Quiz ready — ${questions.length} questions!`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to make quiz from lesson.");
      } finally {
        setPrefilling(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasApiKey, aiConfig]);

  const handleFile = async (file: File) => {
    const error = validateFile(file);
    if (error) { toast.error(error); return; }
    try {
      const { parseFile: pf } = await import("@/lib/fileParser");
      const parsed = await pf(file);
      setUploadedFile({ name: parsed.name, content: parsed.content });
      toast.success("File loaded!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to parse file");
    }
  };

  const handleGenerate = async () => {
    const content = uploadedFile?.content || inputContent;
    if (!content.trim()) { toast.error("Please upload a file or enter some content."); return; }
    if (!hasApiKey) { toast.error("Please add your Gemini API key in Settings."); return; }

    setIsGenerating(true);
    try {
      const questions = await generateQuiz(aiConfig, content, parseInt(numQuestions));
      const quiz: Quiz = {
        id: generateId(),
        title: uploadedFile?.name.replace(/\.[^.]+$/, "") || "Custom Quiz",
        questions,
        sourceContent: content.slice(0, 500),
        createdAt: new Date(),
      };
      await quizDb.save(quiz);
      await refreshQuizzes();
      startQuiz(quiz);
      addSession("quiz", quiz.title);
      toast.success(`Quiz created with ${questions.length} questions!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate quiz");
    } finally {
      setIsGenerating(false);
    }
  };

  const startQuiz = (quiz: Quiz) => {
    setCurrentQuiz(quiz);
    setCurrentQ(0);
    setSelectedAnswers(new Array(quiz.questions.length).fill(null));
    setMode("taking");
    quizStartRef.current = Date.now();
  };

  const selectAnswer = (optionIndex: number) => {
    if (selectedAnswers[currentQ] !== null) return;
    const newAnswers = [...selectedAnswers];
    newAnswers[currentQ] = optionIndex;
    setSelectedAnswers(newAnswers);
  };

  const finishQuiz = () => {
    if (!currentQuiz) return;
    const score = selectedAnswers.reduce<number>((acc, ans, i) => {
      return acc + (ans === currentQuiz.questions[i].correctAnswer ? 1 : 0);
    }, 0);

    const result: QuizResult = {
      quizId: currentQuiz.id,
      score,
      totalQuestions: currentQuiz.questions.length,
      answers: selectedAnswers.map(a => a ?? -1),
      completedAt: new Date(),
    };
    quizDb.saveResult(result).catch(() => {});
    // Log the completion with its score so gamification can award the
    // high-score bonus and count it toward quiz goals/achievements.
    const pct = currentQuiz.questions.length
      ? Math.round((score / currentQuiz.questions.length) * 100)
      : 0;
    const minutes = quizStartRef.current
      ? Math.max(1, Math.round((Date.now() - quizStartRef.current) / 60000))
      : undefined;
    addSession("quiz", `Completed: ${currentQuiz.title}`, { score: pct, duration: minutes });
    setMode("results");
  };

  const resetQuiz = () => {
    setCurrentQuiz(null);
    setMode("setup");
    setSelectedAnswers([]);
    setCurrentQ(0);
  };

  const deleteQuiz = async (id: string) => {
    await quizDb.delete(id);
    await refreshQuizzes();
    toast.success("Quiz deleted");
  };

  const score = currentQuiz
    ? selectedAnswers.filter((a, i) => a === currentQuiz.questions[i]?.correctAnswer).length
    : 0;
  const percentage = currentQuiz ? Math.round((score / currentQuiz.questions.length) * 100) : 0;

  if (mode === "taking" && currentQuiz) {
    const q: QuizQuestion = currentQuiz.questions[currentQ];
    const chosen = selectedAnswers[currentQ];
    const answered = chosen !== null;

    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">{currentQuiz.title}</h2>
              <p className="text-sm text-muted-foreground">
                Question {currentQ + 1} of {currentQuiz.questions.length}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={resetQuiz}>
              <X className="w-4 h-4 mr-2" /> Quit
            </Button>
          </div>

          <Progress value={((currentQ + 1) / currentQuiz.questions.length) * 100} className="h-2" />

          <AnimatePresence mode="wait">
            <motion.div
              key={currentQ}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-medium">{q.question}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {q.options.map((option, i) => {
                    let variant = "default";
                    if (answered) {
                      if (i === q.correctAnswer) variant = "correct";
                      else if (i === chosen) variant = "wrong";
                    }
                    return (
                      <button
                        key={i}
                        onClick={() => selectAnswer(i)}
                        disabled={answered}
                        className={cn(
                          "w-full text-left p-4 rounded-xl border-2 transition-all text-sm",
                          !answered && "hover:border-primary/50 hover:bg-muted/50 cursor-pointer",
                          answered && i === q.correctAnswer && "border-green-500 bg-green-50 dark:bg-green-950/20",
                          answered && i === chosen && i !== q.correctAnswer && "border-red-500 bg-red-50 dark:bg-red-950/20",
                          !answered && "border-border"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0",
                            answered && i === q.correctAnswer ? "border-green-500 bg-green-500 text-white" :
                            answered && i === chosen && i !== q.correctAnswer ? "border-red-500 bg-red-500 text-white" :
                            "border-muted-foreground/30"
                          )}>
                            {answered && i === q.correctAnswer ? <Check className="w-3.5 h-3.5" /> :
                             answered && i === chosen && i !== q.correctAnswer ? <X className="w-3.5 h-3.5" /> :
                             String.fromCharCode(65 + i)}
                          </div>
                          {option}
                        </div>
                      </button>
                    );
                  })}

                  {answered && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-800"
                    >
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-1">Explanation</p>
                      <p className="text-sm text-blue-600 dark:text-blue-300">{q.explanation}</p>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0}>
              <ChevronLeft className="w-4 h-4 mr-2" /> Previous
            </Button>
            {currentQ === currentQuiz.questions.length - 1 ? (
              <Button
                onClick={finishQuiz}
                disabled={selectedAnswers.some(a => a === null)}
                className="bg-gradient-to-r from-violet-600 to-indigo-600"
              >
                <Trophy className="w-4 h-4 mr-2" /> Finish Quiz
              </Button>
            ) : (
              <Button
                onClick={() => setCurrentQ(Math.min(currentQuiz.questions.length - 1, currentQ + 1))}
                disabled={!answered}
              >
                Next <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (mode === "results" && currentQuiz) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <Card className="text-center p-8">
              <div className={cn(
                "w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl font-bold text-white",
                percentage >= 80 ? "bg-gradient-to-br from-green-400 to-emerald-600" :
                percentage >= 60 ? "bg-gradient-to-br from-yellow-400 to-orange-500" :
                "bg-gradient-to-br from-red-400 to-rose-600"
              )}>
                {percentage}%
              </div>
              <h2 className="text-2xl font-bold mb-2">
                {percentage >= 80 ? "Excellent! 🎉" : percentage >= 60 ? "Good Job! 👍" : "Keep Practicing! 💪"}
              </h2>
              <p className="text-muted-foreground mb-6">
                You scored {score} out of {currentQuiz.questions.length} questions
              </p>
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="p-3 bg-muted rounded-xl">
                  <div className="text-2xl font-bold text-green-500">{score}</div>
                  <div className="text-xs text-muted-foreground">Correct</div>
                </div>
                <div className="p-3 bg-muted rounded-xl">
                  <div className="text-2xl font-bold text-red-500">{currentQuiz.questions.length - score}</div>
                  <div className="text-xs text-muted-foreground">Incorrect</div>
                </div>
                <div className="p-3 bg-muted rounded-xl">
                  <div className="text-2xl font-bold text-primary">{percentage}%</div>
                  <div className="text-xs text-muted-foreground">Score</div>
                </div>
              </div>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => startQuiz(currentQuiz)}>
                  <RotateCcw className="w-4 h-4 mr-2" /> Retake Quiz
                </Button>
                <Button onClick={resetQuiz} className="bg-gradient-to-r from-violet-600 to-indigo-600">
                  <Plus className="w-4 h-4 mr-2" /> New Quiz
                </Button>
              </div>
            </Card>
          </motion.div>

          {/* Review answers */}
          <div className="space-y-3">
            <h3 className="font-semibold">Review Answers</h3>
            {currentQuiz.questions.map((q, i) => {
              const userAns = selectedAnswers[i];
              const correct = userAns === q.correctAnswer;
              return (
                <Card key={q.id} className={cn(
                  "border-2",
                  correct ? "border-green-200 dark:border-green-800" : "border-red-200 dark:border-red-800"
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {correct
                        ? <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                        : <X className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />}
                      <div>
                        <p className="font-medium text-sm mb-2">{q.question}</p>
                        <p className="text-xs text-green-600 dark:text-green-400">
                          Correct: {q.options[q.correctAnswer]}
                        </p>
                        {!correct && userAns !== null && (
                          <p className="text-xs text-red-600 dark:text-red-400">
                            Your answer: {q.options[userAns]}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">{q.explanation}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Quiz Generator"
        description="Generate AI-powered quizzes from your study materials"
        icon={<Brain className="w-5 h-5" />}
      />

      {prefilling && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
            <p className="font-medium">Building your quiz…</p>
            <p className="text-sm text-muted-foreground">Generating questions from your lesson.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Generator */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Create New Quiz</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* File upload */}
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all"
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                {uploadedFile ? (
                  <div className="flex items-center gap-3">
                    <File className="w-8 h-8 text-primary" />
                    <div className="text-left">
                      <p className="font-medium text-sm">{uploadedFile.name}</p>
                      <p className="text-xs text-muted-foreground">Click to change</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="font-medium text-sm">Upload a file</p>
                    <p className="text-xs text-muted-foreground">PDF, DOCX, TXT — or type content below</p>
                  </>
                )}
              </div>

              <div className="text-center text-sm text-muted-foreground">— or —</div>

              <div>
                <Label className="text-sm mb-2 block">Paste Content</Label>
                <Textarea
                  placeholder="Paste your study notes, chapter text, or topic content here..."
                  value={inputContent}
                  onChange={(e) => setInputContent(e.target.value)}
                  className="min-h-[120px]"
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label className="text-sm mb-2 block">Number of Questions</Label>
                  <Select value={numQuestions} onValueChange={setNumQuestions}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["5", "10", "15", "20"].map(n => (
                        <SelectItem key={n} value={n}>{n} questions</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 pt-6">
                  <Button
                    onClick={handleGenerate}
                    disabled={(!uploadedFile && !inputContent.trim()) || isGenerating || !hasApiKey}
                    className="w-full bg-gradient-to-r from-violet-600 to-indigo-600"
                  >
                    {isGenerating ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                    ) : (
                      <><Brain className="w-4 h-4 mr-2" /> Generate Quiz</>
                    )}
                  </Button>
                </div>
              </div>

              {!hasApiKey && (
                <p className="text-center text-sm text-muted-foreground">
                  <Link href="/settings" className="text-primary hover:underline">Add your API key</Link> to generate quizzes.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Saved quizzes */}
        <div>
          <h3 className="font-semibold mb-3">Saved Quizzes</h3>
          <ScrollArea className="h-[500px]">
            {quizzes.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground border rounded-xl">
                <Brain className="w-8 h-8 mx-auto mb-2 opacity-40" />
                No quizzes yet
              </div>
            ) : (
              <div className="space-y-3">
                {quizzes.map((quiz) => (
                  <Card key={quiz.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-sm">{quiz.title}</h4>
                        <button
                          onClick={() => deleteQuiz(quiz.id)}
                          className="p-1 rounded hover:text-destructive text-muted-foreground"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                        <Target className="w-3 h-3" />
                        {quiz.questions.length} questions
                        <Clock className="w-3 h-3 ml-1" />
                        {formatDate(quiz.createdAt)}
                      </div>
                      <Button size="sm" className="w-full" onClick={() => startQuiz(quiz)}>
                        Start Quiz
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </DashboardLayout>
  );
}

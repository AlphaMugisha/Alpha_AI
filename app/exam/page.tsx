"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "framer-motion";
import { useStudyData } from "@/hooks/useStudyData";
import { useSettings } from "@/hooks/useSettings";
import { quizDb, notesDb, coursesDb } from "@/lib/db";
import { generateExam, gradeShortAnswers, reviewAnswer } from "@/lib/exam";
import { formatDate, cn } from "@/lib/utils";
import {
  Quiz,
  Note,
  Course,
  ExamQuestion,
  ExamAnswer,
  ExamGrade,
  ExamStrictness,
  StructuredExam,
  ExamSummary,
} from "@/types";
import { toast } from "sonner";
import {
  ClipboardCheck,
  Loader2,
  Check,
  X,
  Flag,
  Clock,
  Target,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Trophy,
  AlertTriangle,
  ListChecks,
  FileText,
  Sparkles,
  GraduationCap,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/PageHeader";
import Link from "next/link";

type Phase = "setup" | "taking" | "results";
type Source = "course" | "quiz";

const DURATION_OPTIONS = ["10", "15", "20", "30", "45", "60", "90"];
const ALL_LESSONS = "__all__";

// Marking scheme: Section A 40 + Section B (best 2 of 4 × 10) 20 = 60 raw → %.
const EXAM_TOTAL = 60;
const SECTION_B_KEEP = 2;

/**
 * Raw score out of 60: all Section A marks + the best SECTION_B_KEEP Section B
 * answers. Returns which Section B question indices actually counted.
 */
function scoreExam(questions: ExamQuestion[], grades: ExamGrade[]) {
  let sectionA = 0;
  const sectionB: { idx: number; awarded: number }[] = [];
  questions.forEach((q, i) => {
    const awarded = grades[i]?.awarded ?? 0;
    if (q.section === "A") sectionA += awarded;
    else sectionB.push({ idx: i, awarded });
  });
  const ranked = [...sectionB].sort((a, b) => b.awarded - a.awarded);
  const counted = ranked.slice(0, SECTION_B_KEEP);
  const countedIdx = new Set(counted.map((s) => s.idx));
  const sectionBScore = counted.reduce((s, v) => s + v.awarded, 0);
  const raw = Math.round((sectionA + sectionBScore) * 10) / 10;
  return { raw, countedIdx };
}

function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function isAnswered(a: ExamAnswer): boolean {
  if (a === null || a === undefined) return false;
  if (typeof a === "string") return a.trim().length > 0;
  return true;
}

// Saved MCQ quizzes are folded into the structured model (Section A, 1 mark each).
function quizToExam(quiz: Quiz): StructuredExam {
  return {
    title: quiz.title,
    questions: quiz.questions.map((q, i) => ({
      id: q.id || `q_${i}`,
      section: "A",
      type: "mcq",
      marks: 1,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
    })),
  };
}

export default function ExamPage() {
  const { addSession } = useStudyData();
  const { aiConfig, hasApiKey } = useSettings();

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  const [phase, setPhase] = useState<Phase>("setup");
  const [source, setSource] = useState<Source>("course");
  const [courseId, setCourseId] = useState<string>("");
  const [lessonId, setLessonId] = useState<string>(ALL_LESSONS);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [duration, setDuration] = useState("30");
  const [passMark, setPassMark] = useState(50);
  const [strictness, setStrictness] = useState<ExamStrictness>("balanced");
  const [building, setBuilding] = useState(false);

  const [activeExam, setActiveExam] = useState<StructuredExam | null>(null);
  // Set only when the exam came from a real saved quiz (for result persistence).
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<ExamAnswer[]>([]);
  const [flagged, setFlagged] = useState<boolean[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [grading, setGrading] = useState(false);
  const [grades, setGrades] = useState<ExamGrade[]>([]);
  const [summary, setSummary] = useState<ExamSummary | null>(null);
  const [claimingIndex, setClaimingIndex] = useState<number | null>(null);
  const [claimed, setClaimed] = useState<Set<number>>(new Set());

  // ----- load library -----
  useEffect(() => {
    Promise.all([quizDb.getAll(), notesDb.getAll(), coursesDb.getAll()])
      .then(([qs, ns, cs]) => {
        setQuizzes(qs);
        setNotes(ns);
        setCourses(cs);
      })
      .catch(() => toast.error("Could not load your library."))
      .finally(() => setLoading(false));
  }, []);

  // ----- deep link from Notes: /exam?lesson=<id> -----
  useEffect(() => {
    if (notes.length === 0) return;
    const lid = new URLSearchParams(window.location.search).get("lesson");
    if (lid) {
      const note = notes.find((n) => n.id === lid);
      setSource("course");
      if (note?.courseId) setCourseId(note.courseId);
      setLessonId(lid);
    }
  }, [notes]);

  const totalSeconds = useMemo(() => parseInt(duration) * 60, [duration]);
  const courseNotes = useMemo(
    () => notes.filter((n) => n.courseId === courseId),
    [notes, courseId]
  );

  // ----- submit / grade -----
  const submitExam = useCallback(
    async (auto = false) => {
      if (!activeExam) return;
      setConfirmSubmit(false);
      setGrading(true);

      const qs = activeExam.questions;
      const result: ExamGrade[] = qs.map((q, i) => {
        if (q.type === "mcq") {
          return { awarded: answers[i] === q.correctAnswer ? q.marks : 0, max: q.marks };
        }
        if (q.type === "truefalse") {
          return { awarded: answers[i] === q.correctBool ? q.marks : 0, max: q.marks };
        }
        return { awarded: 0, max: q.marks }; // short — filled by AI below
      });

      // AI-grade the written (Section B) answers.
      const shortItems = qs
        .map((q, i) => ({ q, i }))
        .filter(({ q }) => q.type === "short");
      if (shortItems.length > 0) {
        try {
          const graded = await gradeShortAnswers(
            aiConfig,
            shortItems.map(({ q, i }) => ({
              question: q.question,
              modelAnswer: q.modelAnswer,
              marks: q.marks,
              answer: typeof answers[i] === "string" ? (answers[i] as string) : "",
            })),
            strictness
          );
          shortItems.forEach(({ i }, k) => {
            result[i] = {
              awarded: graded[k].awarded,
              max: qs[i].marks,
              feedback: graded[k].feedback,
            };
          });
        } catch {
          toast.error("Couldn't auto-grade written answers; they scored 0.");
        }
      }

      const { raw } = scoreExam(qs, result);
      const percentage = Math.round((raw / EXAM_TOTAL) * 100);

      setGrades(result);
      setSummary({
        score: raw,
        totalQuestions: EXAM_TOTAL, // raw is out of 60, shown as a %
        percentage,
        passed: percentage >= passMark,
        passMark,
        timeTakenSeconds: totalSeconds - timeLeft,
      });

      // Persist only saved-quiz exams — quiz_results.quiz_id requires a real quiz.
      if (activeQuizId) {
        const correctCount = result.filter((g) => g.awarded === g.max).length;
        quizDb
          .saveResult({
            quizId: activeQuizId,
            score: correctCount,
            totalQuestions: qs.length,
            answers: [],
            completedAt: new Date(),
          })
          .catch(() => {});
      }
      addSession("quiz", `Exam: ${activeExam.title}`);

      setGrading(false);
      setPhase("results");
      // Leave fullscreen to read results normally.
      try {
        if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      } catch {
        /* ignore */
      }
      if (auto) toast.info("Time's up — exam submitted automatically.");
    },
    [activeExam, activeQuizId, answers, aiConfig, passMark, strictness, totalSeconds, timeLeft, addSession]
  );

  // ----- countdown timer -----
  useEffect(() => {
    if (phase !== "taking") return;
    const id = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase === "taking" && timeLeft === 0) submitExam(true);
  }, [phase, timeLeft, submitExam]);

  // ----- fullscreen helpers (called from the click gesture) -----
  const enterFullscreen = () => {
    try {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } catch {
      /* unsupported — ignore */
    }
  };
  const exitFullscreen = () => {
    try {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    } catch {
      /* ignore */
    }
  };

  // ----- start -----
  const beginExam = (exam: StructuredExam) => {
    setActiveExam(exam);
    setAnswers(new Array(exam.questions.length).fill(null));
    setFlagged(new Array(exam.questions.length).fill(false));
    setCurrentQ(0);
    setTimeLeft(parseInt(duration) * 60);
    setGrades([]);
    setSummary(null);
    setClaimed(new Set());
    setClaimingIndex(null);
    setPhase("taking");
  };

  // Re-grade a single written answer when the student claims (appeals).
  const claimQuestion = async (i: number) => {
    if (!activeExam) return;
    const q = activeExam.questions[i];
    if (q.type !== "short") return;
    setClaimingIndex(i);
    try {
      const prev = grades[i]?.awarded ?? 0;
      const res = await reviewAnswer(
        aiConfig,
        {
          question: q.question,
          modelAnswer: q.modelAnswer,
          marks: q.marks,
          answer: typeof answers[i] === "string" ? (answers[i] as string) : "",
          previous: prev,
        },
        strictness
      );
      const newGrades = grades.map((g, k) =>
        k === i ? { awarded: res.awarded, max: q.marks, feedback: res.feedback } : g
      );
      setGrades(newGrades);
      setClaimed((s) => new Set(s).add(i));

      // Recompute the overall result (best 2 of Section B may change).
      const { raw } = scoreExam(activeExam.questions, newGrades);
      const percentage = Math.round((raw / EXAM_TOTAL) * 100);
      setSummary((s) =>
        s
          ? {
              ...s,
              score: raw,
              percentage,
              passed: percentage >= s.passMark,
            }
          : s
      );

      if (res.awarded > prev) toast.success(`Mark raised: ${prev} → ${res.awarded}`);
      else if (res.awarded < prev) toast.info(`Mark lowered: ${prev} → ${res.awarded}`);
      else toast.info("Mark unchanged after review.");
    } catch {
      toast.error("Couldn't review this answer. Try again.");
    } finally {
      setClaimingIndex(null);
    }
  };

  const startExam = async () => {
    if (source === "quiz") {
      const quiz = quizzes.find((q) => q.id === selectedQuizId);
      if (!quiz) {
        toast.error("Pick a quiz to take as an exam.");
        return;
      }
      setActiveQuizId(quiz.id);
      enterFullscreen();
      beginExam(quizToExam(quiz));
      return;
    }
    setActiveQuizId(null);

    // Course → aggregate lesson content and simulate a full exam.
    if (!courseId) {
      toast.error("Pick a course first.");
      return;
    }
    if (!hasApiKey) {
      toast.error("Add your Gemini API key in Settings to simulate an exam.");
      return;
    }
    const sourceNotes =
      lessonId === ALL_LESSONS
        ? courseNotes
        : courseNotes.filter((n) => n.id === lessonId);
    if (sourceNotes.length === 0) {
      toast.error("This course has no lessons yet. Upload notes for it first.");
      return;
    }

    const course = courses.find((c) => c.id === courseId);
    const content = sourceNotes
      .map((n) => `# ${n.title}\n${n.content}`)
      .join("\n\n---\n\n");

    enterFullscreen();
    setBuilding(true);
    try {
      const questions = await generateExam(aiConfig, content, course?.name);
      beginExam({
        title: course?.name ? `${course.name} — Exam` : "Simulated Exam",
        questions,
      });
      toast.success("Exam paper ready. Good luck!");
    } catch (err) {
      exitFullscreen();
      toast.error(
        err instanceof Error ? err.message : "Failed to simulate the exam."
      );
    } finally {
      setBuilding(false);
    }
  };

  const restart = () => {
    exitFullscreen();
    setPhase("setup");
    setActiveExam(null);
    setAnswers([]);
    setFlagged([]);
    setCurrentQ(0);
    setGrades([]);
    setSummary(null);
  };

  const setAnswer = (value: ExamAnswer) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[currentQ] = value;
      return next;
    });
  };

  const toggleFlag = () => {
    setFlagged((prev) => {
      const next = [...prev];
      next[currentQ] = !next[currentQ];
      return next;
    });
  };

  const answeredCount = answers.filter(isAnswered).length;

  // ============================ TAKING ============================
  if (phase === "taking" && activeExam) {
    const q: ExamQuestion = activeExam.questions[currentQ];
    const total = activeExam.questions.length;
    const lowTime = timeLeft <= 30;
    const ans = answers[currentQ];

    return (
      // No DashboardLayout here on purpose — the exam is "locked": no sidebar,
      // no links out to chat/notes/etc. Fills the screen.
      <div className="fixed inset-0 z-40 overflow-y-auto bg-background p-4 md:p-6">
        <div className="max-w-5xl mx-auto">
          {/* Exam bar */}
          <div className="flex items-center justify-between gap-4 mb-6 p-4 rounded-2xl border bg-card/80 backdrop-blur-sm">
            <div className="min-w-0">
              <h2 className="font-semibold truncate">{activeExam.title}</h2>
              <p className="text-xs text-muted-foreground">
                {answeredCount}/{total} answered
              </p>
            </div>
            <motion.div
              animate={lowTime ? { scale: [1, 1.06, 1] } : {}}
              transition={{ duration: 1, repeat: lowTime ? Infinity : 0 }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-xl font-bold tabular-nums",
                lowTime
                  ? "bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400"
                  : "bg-muted text-foreground"
              )}
            >
              <Clock className="w-5 h-5" />
              {formatClock(timeLeft)}
            </motion.div>
            <Button
              onClick={() => setConfirmSubmit(true)}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 shrink-0"
            >
              <Trophy className="w-4 h-4 mr-2" /> Submit
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-6">
            {/* Question */}
            <div className="space-y-5">
              <Progress value={((currentQ + 1) / total) * 100} className="h-2" />

              <AnimatePresence mode="wait">
                <motion.div
                  key={currentQ}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <Card>
                    <CardHeader className="flex flex-row items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5 text-xs">
                          <span className="px-2 py-0.5 rounded-full bg-muted font-medium">
                            Section {q.section}
                          </span>
                          <span className="text-muted-foreground">
                            {q.marks} {q.marks === 1 ? "mark" : "marks"} ·{" "}
                            {q.type === "mcq"
                              ? "Multiple choice"
                              : q.type === "truefalse"
                                ? "True / False"
                                : "Written answer"}
                          </span>
                        </div>
                        {q.section === "B" && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mb-1.5">
                            Section B: answer any <b>2 of 4</b> — only your best 2 count (20 marks).
                          </p>
                        )}
                        <CardTitle className="text-lg font-medium">
                          <span className="text-muted-foreground mr-2">
                            {currentQ + 1}.
                          </span>
                          {q.question}
                        </CardTitle>
                      </div>
                      <button
                        onClick={toggleFlag}
                        className={cn(
                          "shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                          flagged[currentQ]
                            ? "bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-400"
                            : "border-border text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <Flag
                          className={cn(
                            "w-3.5 h-3.5",
                            flagged[currentQ] && "fill-current"
                          )}
                        />
                        {flagged[currentQ] ? "Flagged" : "Flag"}
                      </button>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {q.type === "mcq" &&
                        (q.options ?? []).map((option, i) => {
                          const chosen = ans === i;
                          return (
                            <button
                              key={i}
                              onClick={() => setAnswer(chosen ? null : i)}
                              className={cn(
                                "w-full text-left p-4 rounded-xl border-2 transition-all text-sm",
                                chosen
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-primary/50 hover:bg-muted/50"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={cn(
                                    "w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0",
                                    chosen
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-muted-foreground/30"
                                  )}
                                >
                                  {String.fromCharCode(65 + i)}
                                </div>
                                {option}
                              </div>
                            </button>
                          );
                        })}

                      {q.type === "truefalse" &&
                        [true, false].map((val) => {
                          const chosen = ans === val;
                          return (
                            <button
                              key={String(val)}
                              onClick={() => setAnswer(chosen ? null : val)}
                              className={cn(
                                "w-full text-left p-4 rounded-xl border-2 transition-all text-sm font-medium",
                                chosen
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-primary/50 hover:bg-muted/50"
                              )}
                            >
                              {val ? "True" : "False"}
                            </button>
                          );
                        })}

                      {q.type === "short" && (
                        <Textarea
                          placeholder="Type your answer here…"
                          value={typeof ans === "string" ? ans : ""}
                          onChange={(e) => setAnswer(e.target.value)}
                          className="min-h-[160px] font-mono text-sm"
                        />
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </AnimatePresence>

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setCurrentQ((c) => Math.max(0, c - 1))}
                  disabled={currentQ === 0}
                >
                  <ChevronLeft className="w-4 h-4 mr-2" /> Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCurrentQ((c) => Math.min(total - 1, c + 1))}
                  disabled={currentQ === total - 1}
                >
                  Next <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>

            {/* Navigator palette */}
            <div className="lg:sticky lg:top-4 h-fit">
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                    <ListChecks className="w-3.5 h-3.5" /> Questions
                  </h3>
                  <div className="grid grid-cols-5 gap-2">
                    {activeExam.questions.map((_, i) => {
                      const isCurrent = i === currentQ;
                      const done = isAnswered(answers[i]);
                      return (
                        <button
                          key={i}
                          onClick={() => setCurrentQ(i)}
                          className={cn(
                            "relative aspect-square rounded-lg text-xs font-semibold flex items-center justify-center border-2 transition-all",
                            isCurrent && "ring-2 ring-primary ring-offset-1",
                            done
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted/50 border-border text-muted-foreground hover:border-primary/50"
                          )}
                        >
                          {i + 1}
                          {flagged[i] && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 border border-background" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded bg-primary" /> Answered
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded bg-muted/50 border border-border" />{" "}
                      Unanswered
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-amber-500" /> Flagged
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Submit confirmation */}
        <Dialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit exam?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              You&apos;ve answered{" "}
              <span className="font-semibold text-foreground">
                {answeredCount} of {activeExam.questions.length}
              </span>{" "}
              questions.
              {answeredCount < activeExam.questions.length &&
                " Unanswered questions score zero — but Section B only counts your best 2 of 4, so leaving 2 of them blank is expected."}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmSubmit(false)}>
                Keep going
              </Button>
              <Button
                onClick={() => submitExam(false)}
                className="bg-gradient-to-r from-violet-600 to-indigo-600"
              >
                Submit exam
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Grading overlay */}
        {grading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
              <p className="font-medium">Grading your exam…</p>
              <p className="text-sm text-muted-foreground">
                Marking written answers with AI.
              </p>
            </div>
          </div>
        )}
      </DashboardLayout>
    );
  }

  // ============================ RESULTS ============================
  if (phase === "results" && activeExam && summary) {
    const { countedIdx } = scoreExam(activeExam.questions, grades);
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <Card className="text-center p-8">
              <div
                className={cn(
                  "w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-bold text-white",
                  summary.passed
                    ? "bg-gradient-to-br from-green-400 to-emerald-600"
                    : "bg-gradient-to-br from-red-400 to-rose-600"
                )}
              >
                {summary.percentage}%
              </div>
              <h2 className="text-2xl font-bold mb-1">
                {summary.passed ? "Passed! 🎉" : "Did not pass 💪"}
              </h2>
              <p className="text-muted-foreground mb-6">
                {summary.score} / {summary.totalQuestions} marks → {summary.percentage}% ·
                pass mark {summary.passMark}%
              </p>
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="p-3 bg-muted rounded-xl">
                  <div className="text-2xl font-bold text-primary">
                    {summary.score}
                  </div>
                  <div className="text-xs text-muted-foreground">Marks</div>
                </div>
                <div className="p-3 bg-muted rounded-xl">
                  <div className="text-2xl font-bold">
                    {summary.totalQuestions}
                  </div>
                  <div className="text-xs text-muted-foreground">Out of</div>
                </div>
                <div className="p-3 bg-muted rounded-xl">
                  <div className="text-2xl font-bold text-primary">
                    {formatClock(summary.timeTakenSeconds)}
                  </div>
                  <div className="text-xs text-muted-foreground">Time</div>
                </div>
              </div>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => beginExam(activeExam)}>
                  <RotateCcw className="w-4 h-4 mr-2" /> Retake
                </Button>
                <Button
                  onClick={restart}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600"
                >
                  <ClipboardCheck className="w-4 h-4 mr-2" /> New Exam
                </Button>
              </div>
            </Card>
          </motion.div>

          {/* Per-question review */}
          <div className="space-y-3">
            <h3 className="font-semibold">Review &amp; Feedback</h3>
            {activeExam.questions.map((q, i) => {
              const g = grades[i];
              const userAns = answers[i];
              const full = g && g.awarded === g.max;
              const partial = g && g.awarded > 0 && g.awarded < g.max;
              return (
                <Card
                  key={q.id}
                  className={cn(
                    "border-2",
                    full
                      ? "border-green-200 dark:border-green-800"
                      : partial
                        ? "border-amber-200 dark:border-amber-800"
                        : "border-red-200 dark:border-red-800"
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="font-medium text-sm">
                        <span className="text-muted-foreground">
                          {i + 1}. [Section {q.section}]{" "}
                        </span>
                        {q.question}
                      </p>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span
                          className={cn(
                            "text-xs font-bold px-2 py-1 rounded-lg",
                            full
                              ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                              : partial
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                                : "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                          )}
                        >
                          {g ? `${g.awarded}/${g.max}` : `0/${q.marks}`}
                        </span>
                        {q.section === "B" && (
                          <span
                            className={cn(
                              "text-[10px] font-medium px-1.5 py-0.5 rounded",
                              countedIdx.has(i)
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {countedIdx.has(i) ? "counts" : "best 2 only"}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Your answer */}
                    <div className="text-xs space-y-1">
                      {q.type === "mcq" && (
                        <>
                          <p className="text-green-600 dark:text-green-400">
                            Correct:{" "}
                            {q.options?.[q.correctAnswer ?? -1] ?? "—"}
                          </p>
                          <p className="text-muted-foreground">
                            Your answer:{" "}
                            {typeof userAns === "number"
                              ? q.options?.[userAns]
                              : "Not answered"}
                          </p>
                        </>
                      )}
                      {q.type === "truefalse" && (
                        <>
                          <p className="text-green-600 dark:text-green-400">
                            Correct: {q.correctBool ? "True" : "False"}
                          </p>
                          <p className="text-muted-foreground">
                            Your answer:{" "}
                            {typeof userAns === "boolean"
                              ? userAns
                                ? "True"
                                : "False"
                              : "Not answered"}
                          </p>
                        </>
                      )}
                      {q.type === "short" && (
                        <>
                          <p className="text-muted-foreground whitespace-pre-wrap">
                            <span className="font-medium text-foreground">
                              Your answer:{" "}
                            </span>
                            {typeof userAns === "string" && userAns.trim()
                              ? userAns
                              : "Not answered"}
                          </p>
                          {g?.feedback && (
                            <p className="text-violet-600 dark:text-violet-400">
                              <span className="font-medium">Feedback: </span>
                              {g.feedback}
                            </p>
                          )}
                          {q.modelAnswer && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                Model answer
                              </summary>
                              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                                {q.modelAnswer}
                              </p>
                            </details>
                          )}
                          <div className="pt-1.5">
                            {claimed.has(i) ? (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <Check className="w-3 h-3" /> Reviewed
                              </span>
                            ) : (
                              <button
                                onClick={() => claimQuestion(i)}
                                disabled={claimingIndex !== null}
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-50"
                              >
                                {claimingIndex === i ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" />{" "}
                                    Reviewing…
                                  </>
                                ) : (
                                  <>
                                    <Scale className="w-3 h-3" /> Claim — request a
                                    re-mark
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </>
                      )}
                      {q.explanation && q.type !== "short" && (
                        <p className="text-muted-foreground pt-0.5">
                          {q.explanation}
                        </p>
                      )}
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

  // ============================ SETUP ============================
  const canStart = source === "quiz" ? !!selectedQuizId : !!courseId;

  return (
    <DashboardLayout>
      <PageHeader
        title="Exam Mode"
        description="Simulate a full exam from a course's lessons, or sit a saved quiz"
        icon={<ClipboardCheck className="w-5 h-5" />}
      />

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <>
          <Tabs
            value={source}
            onValueChange={(v) => setSource(v as Source)}
            className="mb-6"
          >
            <TabsList>
              <TabsTrigger value="course">
                <GraduationCap className="w-4 h-4 mr-2" /> Simulate from a Course
              </TabsTrigger>
              <TabsTrigger value="quiz">
                <Target className="w-4 h-4 mr-2" /> Saved Quiz
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Source picker */}
            <div className="lg:col-span-2">
              {source === "course" ? (
                courses.length === 0 ? (
                  <SourceEmpty
                    title="No courses yet"
                    body="Upload study material in the Notes Generator and assign it to a course. Then simulate a full exam from everything in that course."
                    href="/notes"
                    cta="Go to Notes Generator"
                  />
                ) : (
                  <Card>
                    <CardContent className="p-5 space-y-5">
                      <div>
                        <Label className="text-sm mb-2 block">Course</Label>
                        <Select
                          value={courseId}
                          onValueChange={(v) => {
                            setCourseId(v);
                            setLessonId(ALL_LESSONS);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a course" />
                          </SelectTrigger>
                          <SelectContent>
                            {courses.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-sm mb-2 block">Lesson scope</Label>
                        <Select
                          value={lessonId}
                          onValueChange={setLessonId}
                          disabled={!courseId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="All lessons" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ALL_LESSONS}>
                              All lessons in this course
                              {courseId ? ` (${courseNotes.length})` : ""}
                            </SelectItem>
                            {courseNotes.map((n) => (
                              <SelectItem key={n.id} value={n.id}>
                                {n.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {courseId && courseNotes.length === 0 && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                            This course has no lessons yet.{" "}
                            <Link href="/notes" className="underline">
                              Add some notes
                            </Link>
                            .
                          </p>
                        )}
                      </div>

                      <div className="flex items-start gap-2 text-xs text-muted-foreground p-3 rounded-lg bg-muted/50">
                        <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-violet-500" />
                        The AI reads all selected lessons and sets a paper:
                        Section A (20 × MCQ / True-False, 2 marks = 40) and
                        Section B (4 × written/code, 10 marks — you answer any 2
                        = 20). Total 60, converted to a %. Written answers are
                        AI-graded.
                      </div>
                    </CardContent>
                  </Card>
                )
              ) : quizzes.length === 0 ? (
                <SourceEmpty
                  title="No saved quizzes yet"
                  body="Create a quiz in the Quiz Generator, then sit it here as a timed exam."
                  href="/quiz"
                  cta="Go to Quiz Generator"
                />
              ) : (
                <>
                  <h3 className="font-semibold mb-3">Choose a quiz</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {quizzes.map((quiz) => (
                      <SelectableCard
                        key={quiz.id}
                        selected={selectedQuizId === quiz.id}
                        onClick={() => setSelectedQuizId(quiz.id)}
                        title={quiz.title}
                        meta={
                          <>
                            <Target className="w-3 h-3" />
                            {quiz.questions.length} questions
                            <Clock className="w-3 h-3 ml-1" />
                            {formatDate(quiz.createdAt)}
                          </>
                        }
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Exam settings */}
            <div>
              <h3 className="font-semibold mb-3">Exam settings</h3>
              <Card>
                <CardContent className="p-5 space-y-5">
                  <div>
                    <Label className="text-sm mb-2 block">Time limit</Label>
                    <Select value={duration} onValueChange={setDuration}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DURATION_OPTIONS.map((n) => (
                          <SelectItem key={n} value={n}>
                            {n} minutes
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm">Pass mark</Label>
                      <span className="text-sm font-semibold">{passMark}%</span>
                    </div>
                    <Slider
                      value={[passMark]}
                      min={0}
                      max={100}
                      step={5}
                      onValueChange={([v]) => setPassMark(v)}
                    />
                  </div>

                  {source === "course" && (
                    <div>
                      <Label className="text-sm mb-2 block">
                        Grading strictness
                      </Label>
                      <Select
                        value={strictness}
                        onValueChange={(v) => setStrictness(v as ExamStrictness)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lenient">
                            Lenient — reward partial understanding
                          </SelectItem>
                          <SelectItem value="balanced">
                            Balanced — fair partial marks
                          </SelectItem>
                          <SelectItem value="strict">
                            Strict — require precise, complete answers
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        How harshly the AI marks your written (Section B) answers.
                      </p>
                    </div>
                  )}

                  <div className="flex items-start gap-2 text-xs text-muted-foreground p-3 rounded-lg bg-muted/50">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                    No answers are shown until you submit. The exam auto-submits
                    when time runs out.
                  </div>

                  <Button
                    onClick={startExam}
                    disabled={!canStart || building}
                    className="w-full bg-gradient-to-r from-violet-600 to-indigo-600"
                  >
                    {building ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Setting
                        paper…
                      </>
                    ) : source === "course" ? (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" /> Simulate Exam
                      </>
                    ) : (
                      <>
                        <ClipboardCheck className="w-4 h-4 mr-2" /> Start Exam
                      </>
                    )}
                  </Button>

                  {source === "course" && !hasApiKey && (
                    <p className="text-center text-xs text-muted-foreground">
                      <Link href="/settings" className="text-primary hover:underline">
                        Add your API key
                      </Link>{" "}
                      to simulate exams.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

// ----- small presentational helpers -----
function SelectableCard({
  selected,
  onClick,
  title,
  meta,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  meta: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-left p-4 rounded-xl border-2 transition-all",
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border hover:border-primary/40 hover:bg-muted/40"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-medium text-sm">{title}</h4>
        {selected && (
          <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
            <Check className="w-3 h-3" />
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {meta}
      </div>
    </button>
  );
}

function SourceEmpty({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center border rounded-xl">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mb-4">
        <ClipboardCheck className="w-7 h-7 text-white" />
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm max-w-sm mb-6">{body}</p>
      <Button asChild className="bg-gradient-to-r from-violet-600 to-indigo-600">
        <Link href={href}>{cta}</Link>
      </Button>
    </div>
  );
}

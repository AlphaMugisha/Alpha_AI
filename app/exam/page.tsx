"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "framer-motion";
import { useStudyData } from "@/hooks/useStudyData";
import { quizDb } from "@/lib/db";
import { formatDate, cn } from "@/lib/utils";
import { Quiz, QuizQuestion, ExamSummary } from "@/types";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const DURATION_OPTIONS = ["5", "10", "15", "20", "30", "45", "60"];

function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function ExamPage() {
  const { addSession } = useStudyData();

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  const [phase, setPhase] = useState<Phase>("setup");
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [duration, setDuration] = useState("15");
  const [passMark, setPassMark] = useState(50);

  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [flagged, setFlagged] = useState<boolean[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [summary, setSummary] = useState<ExamSummary | null>(null);

  // ----- load saved quizzes -----
  useEffect(() => {
    quizDb
      .getAll()
      .then(setQuizzes)
      .catch(() => toast.error("Could not load quizzes."))
      .finally(() => setLoading(false));
  }, []);

  const totalSeconds = useMemo(() => parseInt(duration) * 60, [duration]);

  // ----- submit / grade -----
  const submitExam = useCallback(
    (auto = false) => {
      if (!activeQuiz) return;
      const score = answers.reduce<number>(
        (acc, ans, i) =>
          acc + (ans === activeQuiz.questions[i].correctAnswer ? 1 : 0),
        0
      );
      const total = activeQuiz.questions.length;
      const percentage = Math.round((score / total) * 100);

      setSummary({
        score,
        totalQuestions: total,
        percentage,
        passed: percentage >= passMark,
        passMark,
        timeTakenSeconds: totalSeconds - timeLeft,
      });

      quizDb
        .saveResult({
          quizId: activeQuiz.id,
          score,
          totalQuestions: total,
          answers: answers.map((a) => a ?? -1),
          completedAt: new Date(),
        })
        .catch(() => {});
      addSession("quiz", `Exam: ${activeQuiz.title}`);

      setConfirmSubmit(false);
      setPhase("results");
      if (auto) toast.info("Time's up — exam submitted automatically.");
    },
    [activeQuiz, answers, passMark, totalSeconds, timeLeft, addSession]
  );

  // ----- countdown timer -----
  useEffect(() => {
    if (phase !== "taking") return;
    const id = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  // auto-submit when the clock hits zero
  useEffect(() => {
    if (phase === "taking" && timeLeft === 0) submitExam(true);
  }, [phase, timeLeft, submitExam]);

  // ----- start -----
  const startExam = () => {
    const quiz = quizzes.find((q) => q.id === selectedQuizId);
    if (!quiz) {
      toast.error("Pick a quiz to take as an exam.");
      return;
    }
    setActiveQuiz(quiz);
    setAnswers(new Array(quiz.questions.length).fill(null));
    setFlagged(new Array(quiz.questions.length).fill(false));
    setCurrentQ(0);
    setTimeLeft(parseInt(duration) * 60);
    setSummary(null);
    setPhase("taking");
  };

  const restart = () => {
    setPhase("setup");
    setActiveQuiz(null);
    setAnswers([]);
    setFlagged([]);
    setCurrentQ(0);
    setSummary(null);
  };

  const chooseAnswer = (optionIndex: number) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[currentQ] = next[currentQ] === optionIndex ? null : optionIndex;
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

  const answeredCount = answers.filter((a) => a !== null).length;

  // ============================ TAKING ============================
  if (phase === "taking" && activeQuiz) {
    const q: QuizQuestion = activeQuiz.questions[currentQ];
    const total = activeQuiz.questions.length;
    const lowTime = timeLeft <= 30;

    return (
      <DashboardLayout>
        <div className="max-w-5xl mx-auto">
          {/* Sticky exam bar */}
          <div className="flex items-center justify-between gap-4 mb-6 p-4 rounded-2xl border bg-card/80 backdrop-blur-sm">
            <div className="min-w-0">
              <h2 className="font-semibold truncate">{activeQuiz.title}</h2>
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
                      <CardTitle className="text-lg font-medium">
                        <span className="text-muted-foreground mr-2">
                          {currentQ + 1}.
                        </span>
                        {q.question}
                      </CardTitle>
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
                      {q.options.map((option, i) => {
                        const chosen = answers[currentQ] === i;
                        return (
                          <button
                            key={i}
                            onClick={() => chooseAnswer(i)}
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
                    {activeQuiz.questions.map((_, i) => {
                      const isCurrent = i === currentQ;
                      const isAnswered = answers[i] !== null;
                      const isFlagged = flagged[i];
                      return (
                        <button
                          key={i}
                          onClick={() => setCurrentQ(i)}
                          className={cn(
                            "relative aspect-square rounded-lg text-xs font-semibold flex items-center justify-center border-2 transition-all",
                            isCurrent && "ring-2 ring-primary ring-offset-1",
                            isAnswered
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted/50 border-border text-muted-foreground hover:border-primary/50"
                          )}
                        >
                          {i + 1}
                          {isFlagged && (
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
                {answeredCount} of {activeQuiz.questions.length}
              </span>{" "}
              questions.
              {answeredCount < activeQuiz.questions.length &&
                " Unanswered questions will be marked incorrect."}
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
      </DashboardLayout>
    );
  }

  // ============================ RESULTS ============================
  if (phase === "results" && activeQuiz && summary) {
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
                {summary.score} of {summary.totalQuestions} correct · pass mark{" "}
                {summary.passMark}%
              </p>
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="p-3 bg-muted rounded-xl">
                  <div className="text-2xl font-bold text-green-500">
                    {summary.score}
                  </div>
                  <div className="text-xs text-muted-foreground">Correct</div>
                </div>
                <div className="p-3 bg-muted rounded-xl">
                  <div className="text-2xl font-bold text-red-500">
                    {summary.totalQuestions - summary.score}
                  </div>
                  <div className="text-xs text-muted-foreground">Incorrect</div>
                </div>
                <div className="p-3 bg-muted rounded-xl">
                  <div className="text-2xl font-bold text-primary">
                    {formatClock(summary.timeTakenSeconds)}
                  </div>
                  <div className="text-xs text-muted-foreground">Time</div>
                </div>
              </div>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={startExam}>
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

          {/* Review */}
          <div className="space-y-3">
            <h3 className="font-semibold">Review Answers</h3>
            {activeQuiz.questions.map((q, i) => {
              const userAns = answers[i];
              const correct = userAns === q.correctAnswer;
              return (
                <Card
                  key={q.id}
                  className={cn(
                    "border-2",
                    correct
                      ? "border-green-200 dark:border-green-800"
                      : "border-red-200 dark:border-red-800"
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {correct ? (
                        <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      ) : (
                        <X className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="font-medium text-sm mb-2">
                          {i + 1}. {q.question}
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-400">
                          Correct: {q.options[q.correctAnswer]}
                        </p>
                        {userAns === null ? (
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            Not answered
                          </p>
                        ) : (
                          !correct && (
                            <p className="text-xs text-red-600 dark:text-red-400">
                              Your answer: {q.options[userAns]}
                            </p>
                          )
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {q.explanation}
                        </p>
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

  // ============================ SETUP ============================
  return (
    <DashboardLayout>
      <PageHeader
        title="Exam Mode"
        description="Take a saved quiz under timed exam conditions — no hints until you finish"
        icon={<ClipboardCheck className="w-5 h-5" />}
      />

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : quizzes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mb-4">
            <ClipboardCheck className="w-8 h-8 text-white" />
          </div>
          <h3 className="font-semibold text-lg mb-2">No quizzes to examine yet</h3>
          <p className="text-muted-foreground text-sm max-w-sm mb-6">
            Exam Mode runs your saved quizzes against a timer. Create one in the
            Quiz Generator first, then come back to sit it as an exam.
          </p>
          <Button
            asChild
            className="bg-gradient-to-r from-violet-600 to-indigo-600"
          >
            <Link href="/quiz">Go to Quiz Generator</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pick a quiz */}
          <div className="lg:col-span-2">
            <h3 className="font-semibold mb-3">Choose a quiz</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {quizzes.map((quiz) => {
                const selected = selectedQuizId === quiz.id;
                return (
                  <button
                    key={quiz.id}
                    onClick={() => setSelectedQuizId(quiz.id)}
                    className={cn(
                      "text-left p-4 rounded-xl border-2 transition-all",
                      selected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/40 hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-medium text-sm">{quiz.title}</h4>
                      {selected && (
                        <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Target className="w-3 h-3" />
                      {quiz.questions.length} questions
                      <Clock className="w-3 h-3 ml-1" />
                      {formatDate(quiz.createdAt)}
                    </div>
                  </button>
                );
              })}
            </div>
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

                <div className="flex items-start gap-2 text-xs text-muted-foreground p-3 rounded-lg bg-muted/50">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                  No answers or explanations are shown until you submit. The exam
                  auto-submits when time runs out.
                </div>

                <Button
                  onClick={startExam}
                  disabled={!selectedQuizId}
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600"
                >
                  <ClipboardCheck className="w-4 h-4 mr-2" /> Start Exam
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

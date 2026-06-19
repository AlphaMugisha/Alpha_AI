"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { motion } from "framer-motion";
import Link from "next/link";
import { useCoach } from "@/hooks/useCoach";
import { useSettings } from "@/hooks/useSettings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  RefreshCw,
  Mic,
  Flame,
  Activity,
  Target,
  ListTodo,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  CalendarRange,
  Brain,
  Layers,
  Loader2,
  ArrowRight,
  Trophy,
  GraduationCap,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { WeeklyReport, SmartPlan, CoachRecommendation } from "@/lib/coach/types";
import { useJarvis } from "@/context/JarvisContext";

const ACTION_HREF: Record<CoachRecommendation["action"], string> = {
  plan: "/coach?tab=plan",
  explain: "/explain",
  quiz: "/quiz",
  revise: "/flashcards",
  task: "/planner",
};
const ACTION_ICON: Record<CoachRecommendation["action"], typeof Brain> = {
  plan: CalendarRange,
  explain: Lightbulb,
  quiz: Brain,
  revise: Layers,
  task: ListTodo,
};

function accuracyColor(acc: number) {
  if (acc >= 80) return "text-green-600 dark:text-green-400";
  if (acc >= 60) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

export default function CoachPage() {
  const { snapshot, daily, loading, regenerate, regenerating, getWeeklyReport, generatePlan } =
    useCoach();
  const { hasApiKey } = useSettings();
  const jarvis = useJarvis();
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "plan") setTab("plan");
    if (params.get("tab") === "report") setTab("report");
  }, []);

  return (
    <DashboardLayout>
      <PageHeader
        title="Jarvis"
        description="Your personal AI tutor, mentor, and academic advisor — guided by your real study data."
        icon={<Sparkles className="w-5 h-5" />}
        action={
          <div className="flex gap-2">
            <Button
              onClick={() => jarvis.setOpen(true)}
              className="bg-gradient-to-r from-violet-600 to-indigo-600"
            >
              <Mic className="w-4 h-4 mr-2" /> Talk to Jarvis
            </Button>
            <Button
              onClick={regenerate}
              disabled={regenerating || loading}
              variant="outline"
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", regenerating && "animate-spin")} />
              Refresh
            </Button>
          </div>
        }
      />

      {!hasApiKey && (
        <div className="mb-6 flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="flex-1 text-sm text-amber-700 dark:text-amber-400">
            Jarvis is running on real data without AI phrasing. Add an API key to unlock
            richer, conversational guidance and smart plans.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/settings">Add Key</Link>
          </Button>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="plan">Smart Study Plan</TabsTrigger>
          <TabsTrigger value="report">Weekly Report</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Overview />
        </TabsContent>
        <TabsContent value="plan">
          <PlanTab generatePlan={generatePlan} hasApiKey={hasApiKey} />
        </TabsContent>
        <TabsContent value="report">
          <ReportTab getWeeklyReport={getWeeklyReport} />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );

  // ----------------------------- Overview -----------------------------
  function Overview() {
    if (loading && !daily) {
      return (
        <div className="space-y-4">
          <div className="h-40 bg-muted rounded-2xl animate-pulse" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      );
    }
    if (!snapshot || !daily) {
      return (
        <p className="text-muted-foreground text-sm">
          Start studying and Jarvis will begin guiding you.
        </p>
      );
    }

    const stats = [
      { label: "Day streak", value: snapshot.streakDays, icon: Flame, color: "text-orange-500" },
      { label: "Activities this week", value: snapshot.activitiesThisWeek, icon: Activity, color: "text-blue-500" },
      {
        label: "Avg accuracy",
        value: snapshot.averageAccuracy !== null ? `${snapshot.averageAccuracy}%` : "—",
        icon: Target,
        color: "text-violet-500",
      },
      { label: "Pending tasks", value: snapshot.pendingTasks, icon: ListTodo, color: "text-green-500" },
    ];

    return (
      <div className="space-y-6">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-7 text-white overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="relative z-10">
            <h2 className="text-2xl font-bold">{daily.greeting}</h2>
            <p className="text-violet-100 mt-1">{daily.headline}</p>
            <div className="mt-4 rounded-xl bg-white/15 backdrop-blur-sm p-4 max-w-2xl">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">
                  Today&apos;s recommendation
                </span>
                {daily.prioritySubject && (
                  <Badge className="bg-white/25 hover:bg-white/25 text-white text-[10px]">
                    {daily.prioritySubject}
                  </Badge>
                )}
              </div>
              <p className="text-sm">{daily.recommendation}</p>
            </div>
            <p className="text-violet-100 italic mt-3 text-sm">&ldquo;{daily.motivation}&rdquo;</p>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <s.icon className={cn("w-5 h-5 mb-2", s.color)} />
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Exam mode */}
        {snapshot.examMode && snapshot.nextExam && (
          <Card className="border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-red-600 dark:text-red-400">
                <GraduationCap className="w-5 h-5" /> Exam Mode
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-3">
                <span className="font-semibold">{snapshot.nextExam.title}</span> is in{" "}
                <span className="font-semibold">{snapshot.nextExam.daysRemaining} day(s)</span>.
                Recommended revision focus:
              </p>
              <ol className="space-y-1.5 text-sm">
                {[snapshot.weakestSubject, ...snapshot.staleSubjects]
                  .filter((x): x is NonNullable<typeof x> => !!x)
                  .filter((x, i, arr) => arr.findIndex((y) => y.subject === x.subject) === i)
                  .slice(0, 4)
                  .map((sub, i) => (
                    <li key={sub.subject} className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 text-xs flex items-center justify-center font-semibold">
                        {i + 1}
                      </span>
                      {sub.subject}
                      {sub.accuracy !== null && (
                        <span className={cn("text-xs", accuracyColor(sub.accuracy))}>
                          {sub.accuracy}%
                        </span>
                      )}
                    </li>
                  ))}
              </ol>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily recommendations */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-500" /> Today&apos;s Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {daily.recommendations.map((r, i) => {
                const Icon = ACTION_ICON[r.action] ?? Sparkles;
                return (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{r.title}</div>
                      <div className="text-xs text-muted-foreground">{r.reason}</div>
                    </div>
                    <Button asChild size="sm" variant="ghost" className="shrink-0 h-8">
                      <Link href={ACTION_HREF[r.action] ?? "/dashboard"}>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Insights */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500" /> AI Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {daily.insights.map((ins, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      "mt-1.5 w-2 h-2 rounded-full shrink-0",
                      ins.tone === "positive" && "bg-green-500",
                      ins.tone === "warning" && "bg-red-500",
                      ins.tone === "neutral" && "bg-muted-foreground/40"
                    )}
                  />
                  <p className="text-sm text-muted-foreground">{ins.text}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Subjects */}
        {snapshot.subjects.some((s) => s.accuracy !== null) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="w-4 h-4 text-violet-500" /> Subject Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {snapshot.subjects
                .filter((s) => s.accuracy !== null)
                .sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0))
                .map((sub) => (
                  <div key={sub.subject}>
                    <div className="flex items-center justify-between mb-1 text-sm">
                      <span className="font-medium flex items-center gap-2">
                        {sub.subject}
                        {snapshot.weakestSubject?.subject === sub.subject && (
                          <Badge variant="destructive" className="text-[10px]">
                            <TrendingDown className="w-3 h-3 mr-0.5" /> weakest
                          </Badge>
                        )}
                        {snapshot.strongestSubject?.subject === sub.subject &&
                          snapshot.weakestSubject?.subject !== sub.subject && (
                            <Badge className="bg-green-500/15 text-green-600 dark:text-green-400 text-[10px] hover:bg-green-500/15">
                              <Trophy className="w-3 h-3 mr-0.5" /> strongest
                            </Badge>
                          )}
                      </span>
                      <span className={cn("font-semibold", accuracyColor(sub.accuracy!))}>
                        {sub.accuracy}%
                      </span>
                    </div>
                    <Progress value={sub.accuracy!} className="h-2" />
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{sub.attempts} attempt(s)</span>
                      {sub.daysSinceReview !== null && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> reviewed {sub.daysSinceReview}d ago
                        </span>
                      )}
                      {sub.pendingTasks > 0 && <span>{sub.pendingTasks} pending task(s)</span>}
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }
}

// ----------------------------- Plan tab -----------------------------
function PlanTab({
  generatePlan,
  hasApiKey,
}: {
  generatePlan: (o: { days: number; minutesPerDay: number }) => Promise<SmartPlan>;
  hasApiKey: boolean;
}) {
  const [days, setDays] = useState("5");
  const [minutes, setMinutes] = useState("120");
  const [plan, setPlan] = useState<SmartPlan | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!hasApiKey) {
      toast.error("Add an AI API key in Settings to generate a smart plan.");
      return;
    }
    setBusy(true);
    try {
      const result = await generatePlan({
        days: parseInt(days),
        minutesPerDay: parseInt(minutes),
      });
      setPlan(result);
      toast.success("Study plan ready!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate plan");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-1 h-fit">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-violet-500" /> Smart Study Plan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            I&apos;ll build a personalised timetable that prioritises your weak subjects,
            overdue revision, and upcoming exams.
          </p>
          <div>
            <Label className="text-sm mb-2 block">Plan length</Label>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 days</SelectItem>
                <SelectItem value="5">5 days</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm mb-2 block">Minutes per day</Label>
            <Select value={minutes} onValueChange={setMinutes}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["60", "90", "120", "180", "240"].map((m) => (
                  <SelectItem key={m} value={m}>
                    {parseInt(m) >= 60 ? `${parseInt(m) / 60} hour(s)` : `${m} min`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={run}
            disabled={busy}
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600"
          >
            {busy ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Building plan...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" /> Generate Plan</>
            )}
          </Button>
        </CardContent>
      </Card>

      <div className="lg:col-span-2">
        {plan ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{plan.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{plan.rationale}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {plan.days.map((d, i) => (
                <div key={i} className="rounded-lg border p-4">
                  <h4 className="font-semibold text-sm mb-2">{d.day}</h4>
                  <div className="space-y-2">
                    {d.blocks.map((b, j) => (
                      <div key={j} className="flex items-center gap-3 text-sm">
                        <Badge variant="secondary" className="shrink-0 tabular-nums">
                          {b.minutes}m
                        </Badge>
                        <span className="font-medium shrink-0">{b.subject}</span>
                        <span className="text-muted-foreground text-xs truncate">{b.focus}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <div className="h-full min-h-[300px] flex items-center justify-center border border-dashed rounded-xl">
            <div className="text-center p-8">
              <CalendarRange className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm">
                Generate a plan and your personalised timetable will appear here.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------- Report tab -----------------------------
function ReportTab({
  getWeeklyReport,
}: {
  getWeeklyReport: (force?: boolean) => Promise<WeeklyReport | null>;
}) {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getWeeklyReport()
      .then((r) => active && setReport(r))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [getWeeklyReport]);

  if (loading) {
    return <div className="h-64 bg-muted rounded-2xl animate-pulse" />;
  }
  if (!report) {
    return <p className="text-sm text-muted-foreground">No report available yet.</p>;
  }

  const metrics = [
    { label: "Study time", value: report.totalHours, icon: Clock },
    { label: "Quiz performance", value: report.quizPerformance, icon: Target },
    { label: "Best subject", value: report.bestSubject, icon: Trophy },
    { label: "Weakest subject", value: report.weakestSubject, icon: TrendingDown },
    { label: "Most improved", value: report.mostImproved, icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20 border-violet-200 dark:border-violet-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-500" /> Your Week in Review
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{report.summary}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardContent className="p-4">
              <m.icon className="w-5 h-5 mb-2 text-violet-500" />
              <div className="text-sm font-semibold">{m.value}</div>
              <div className="text-xs text-muted-foreground">{m.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-violet-500" /> Recommendations for Next Week
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {report.nextWeek.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                {rec}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

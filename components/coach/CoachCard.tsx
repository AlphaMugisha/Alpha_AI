"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useCoach } from "@/hooks/useCoach";
import { useJarvis } from "@/context/JarvisContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  RefreshCw,
  Mic,
  CalendarRange,
  Lightbulb,
  Brain,
  Layers,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const QUICK_ACTIONS = [
  { label: "Create Study Plan", href: "/coach?tab=plan", icon: CalendarRange },
  { label: "Explain Weak Topic", href: "/explain", icon: Lightbulb },
  { label: "Generate Quiz", href: "/quiz", icon: Brain },
  { label: "Start Revision", href: "/flashcards", icon: Layers },
];

export function CoachCard() {
  const { daily, snapshot, loading, regenerate, regenerating } = useCoach();
  const jarvis = useJarvis();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-2xl border border-violet-200 dark:border-violet-900/50 bg-gradient-to-br from-violet-50 via-white to-indigo-50 dark:from-violet-950/30 dark:via-card dark:to-indigo-950/20 p-6 overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-48 h-48 bg-violet-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Jarvis</h3>
              {snapshot?.examMode && snapshot.nextExam && (
                <Badge variant="destructive" className="mt-0.5 text-[10px] gap-1">
                  <AlertTriangle className="w-3 h-3" /> Exam mode
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => jarvis.setOpen(true)}
              title="Talk to Jarvis"
            >
              <Mic className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={regenerate}
              disabled={regenerating || loading}
              title="Regenerate today's coaching"
            >
              <RefreshCw className={cn("h-4 w-4", regenerating && "animate-spin")} />
            </Button>
            <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
              <Link href="/coach">
                Open <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            </Button>
          </div>
        </div>

        {loading && !daily ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-5 w-48 bg-muted rounded" />
            <div className="h-4 w-72 bg-muted rounded" />
            <div className="h-4 w-64 bg-muted rounded" />
          </div>
        ) : daily ? (
          <>
            <p className="text-lg font-semibold">{daily.greeting}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{daily.headline}</p>

            <div className="mt-4 rounded-xl bg-white/70 dark:bg-white/5 border border-violet-100 dark:border-violet-900/40 p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <span className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                  Today&apos;s recommendation
                </span>
                {daily.prioritySubject && (
                  <Badge variant="secondary" className="text-[10px]">
                    {daily.prioritySubject}
                  </Badge>
                )}
              </div>
              <p className="text-sm">{daily.recommendation}</p>
            </div>

            <p className="text-sm text-muted-foreground italic mt-3">
              &ldquo;{daily.motivation}&rdquo;
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
              {QUICK_ACTIONS.map((a) => (
                <Button
                  key={a.label}
                  asChild
                  variant="outline"
                  size="sm"
                  className="justify-start text-xs h-9 bg-white/60 dark:bg-white/5"
                >
                  <Link href={a.href}>
                    <a.icon className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                    <span className="truncate">{a.label}</span>
                  </Link>
                </Button>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Start studying and Jarvis will begin guiding you.
          </p>
        )}
      </div>
    </motion.div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { getCommitGoal, type CommitGoal } from "@/app/actions/github";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Github, RefreshCw, Target, ArrowRight, Flame } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function Ring({ pct, count, goal }: { pct: number; count: number; goal: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const done = pct >= 1;
  return (
    <div className="relative w-32 h-32 shrink-0">
      <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="10"
          className="stroke-muted"
        />
        <motion.circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className={cn(done ? "stroke-green-500" : "stroke-violet-500")}
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.min(pct, 1)) }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold leading-none">{count}</span>
        <span className="text-xs text-muted-foreground">/ {goal}</span>
      </div>
    </div>
  );
}

export function CommitGoalWidget() {
  const [data, setData] = useState<CommitGoal | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getCommitGoal(startOfTodayISO()));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Not connected → prompt to connect.
  if (!loading && data && !data.connected) {
    return (
      <Card className="border-violet-200 dark:border-violet-800 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0">
            <Github className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Track your daily commit goal</p>
            <p className="text-xs text-muted-foreground">
              Connect GitHub to see your commits and get push reminders.
            </p>
          </div>
          <Button asChild size="sm" className="bg-gradient-to-r from-violet-600 to-indigo-600">
            <Link href="/settings">
              Connect <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Connected but no focus repo chosen.
  if (!loading && data && data.connected && !data.focusRepo) {
    return (
      <Card>
        <CardContent className="p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center shrink-0">
            <Target className="w-5 h-5 text-violet-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Pick a focus repo</p>
            <p className="text-xs text-muted-foreground">
              Choose which repo to track for your daily commit goal.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/repos">Choose repo</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const count = data?.count ?? 0;
  const goal = data?.dailyGoal ?? 20;
  const pct = goal > 0 ? count / goal : 0;
  const done = count >= goal;
  const remaining = Math.max(0, goal - count);

  return (
    <Card className={cn(done && "border-green-300 dark:border-green-800")}>
      <CardContent className="p-5">
        <div className="flex items-center gap-5">
          <Ring pct={pct} count={count} goal={goal} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Flame className={cn("w-4 h-4", done ? "text-green-500" : "text-orange-500")} />
              <h3 className="font-semibold">Daily Commit Goal</h3>
            </div>
            {data?.focusRepo && (
              <a
                href={`https://github.com/${data.focusRepo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 mb-2"
              >
                <Github className="w-3 h-3" /> {data.focusRepo}
              </a>
            )}
            <p className={cn("text-sm font-medium", done ? "text-green-600 dark:text-green-400" : "")}>
              {loading
                ? "Checking GitHub…"
                : data?.error
                ? "Couldn't reach GitHub — check your token."
                : done
                ? `🎉 Goal smashed! ${count} commits today.`
                : count === 0
                ? `0 commits yet today — time to start! ${goal} to go.`
                : `${remaining} more commit${remaining === 1 ? "" : "s"} to hit your goal.`}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={load}
              disabled={loading}
              className="mt-2 -ml-2 h-7 text-xs text-muted-foreground"
            >
              <RefreshCw className={cn("w-3 h-3 mr-1.5", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

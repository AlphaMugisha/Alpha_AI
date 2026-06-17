"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  getCommitGoal,
  listRepos,
  setFocusRepo,
  type CommitGoal,
  type RepoInfo,
} from "@/app/actions/github";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Github, RefreshCw, Target, ArrowRight, Flame, Loader2 } from "lucide-react";
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
  const [repos, setRepos] = useState<RepoInfo[] | null>(null);
  const [saving, setSaving] = useState(false);

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

  // When connected but no focus repo yet, fetch the repo list for the inline picker.
  useEffect(() => {
    if (data?.connected && !data.focusRepo && repos === null) {
      listRepos().then((res) => setRepos(res.repos ?? [])).catch(() => setRepos([]));
    }
  }, [data, repos]);

  const chooseFocus = async (fullName: string) => {
    if (!fullName) return;
    setSaving(true);
    const res = await setFocusRepo(fullName);
    if (res?.error) {
      toast.error(res.error);
      setSaving(false);
      return;
    }
    await load(); // reloads commit goal → big number appears
    setSaving(false);
  };

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

  // Connected but no focus repo chosen → let them pick one right here.
  if (!loading && data && data.connected && !data.focusRepo) {
    return (
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-violet-500" />
            <h3 className="font-semibold">Daily Commit Goal</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Pick the repo you want to track {data.dailyGoal} commits/day on:
          </p>
          {repos === null ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading your repos…
            </div>
          ) : repos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No repos found.{" "}
              <Link href="/repos" className="text-primary hover:underline">
                Open My Repos
              </Link>
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <select
                defaultValue=""
                disabled={saving}
                onChange={(e) => chooseFocus(e.target.value)}
                className="flex-1 h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="" disabled>
                  Choose a repo…
                </option>
                {repos.map((r) => (
                  <option key={r.fullName} value={r.fullName}>
                    {r.name}
                  </option>
                ))}
              </select>
              {saving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </div>
          )}
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

            {/* BIG "how many commits left" focal point */}
            {loading ? (
              <p className="text-sm text-muted-foreground">Checking GitHub…</p>
            ) : data?.error ? (
              <p className="text-sm font-medium text-destructive">
                Couldn&apos;t reach GitHub — check your token.
              </p>
            ) : done ? (
              <p className="text-4xl font-bold text-green-600 dark:text-green-400 leading-none">
                🎉 Goal reached!
              </p>
            ) : (
              <p className="leading-none">
                <span className="text-5xl font-bold text-violet-600 dark:text-violet-400">
                  {remaining}
                </span>
                <span className="text-2xl font-bold text-foreground ml-2">
                  commit{remaining === 1 ? "" : "s"} to go
                </span>
              </p>
            )}

            {/* Always show today's progress vs goal */}
            <p className="text-sm text-muted-foreground mt-2">
              {count} of {goal} commits done today
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

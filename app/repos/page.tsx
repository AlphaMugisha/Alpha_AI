"use client";

import { useEffect, useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion } from "framer-motion";
import {
  listRepos,
  classifyRepo,
  setFocusRepo,
  setRepoDone,
  getGithubStatus,
  type RepoInfo,
} from "@/app/actions/github";
import { toast } from "sonner";
import {
  Github,
  Lock,
  Globe,
  Loader2,
  Target,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Archive,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { timeAgo } from "@/lib/utils";
import Link from "next/link";
import { cn } from "@/lib/utils";

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  project: {
    label: "Project",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  },
  submission: {
    label: "Submission",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  },
  revision: {
    label: "Revision",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  },
};

const STALE_DAYS = 2;

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

type Filter = "all" | "project" | "submission" | "revision" | "stale" | "done";

export default function ReposPage() {
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [focusRepo, setFocus] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    (async () => {
      const status = await getGithubStatus();
      setConnected(status.connected);
      setFocus(status.focusRepo);
      if (status.connected) {
        const res = await listRepos();
        if (res.error) toast.error(res.error);
        else setRepos(res.repos ?? []);
      }
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return repos.filter((r) => !r.done);
    if (filter === "done") return repos.filter((r) => r.done);
    if (filter === "stale")
      return repos.filter((r) => {
        const d = daysSince(r.pushedAt);
        return !r.done && d !== null && d >= STALE_DAYS;
      });
    return repos.filter((r) => !r.done && r.category === filter);
  }, [repos, filter]);

  const staleCount = useMemo(
    () =>
      repos.filter((r) => {
        const d = daysSince(r.pushedAt);
        return !r.done && d !== null && d >= STALE_DAYS;
      }).length,
    [repos]
  );

  const doneCount = useMemo(() => repos.filter((r) => r.done).length, [repos]);

  const onClassify = async (repo: RepoInfo, value: string) => {
    const category =
      value === "none" ? null : (value as RepoInfo["category"]);
    setRepos((prev) =>
      prev.map((r) => (r.fullName === repo.fullName ? { ...r, category } : r))
    );
    const res = await classifyRepo(repo.fullName, category);
    if (res?.error) toast.error(res.error);
  };

  const onSetFocus = async (repo: RepoInfo) => {
    setFocus(repo.fullName);
    const res = await setFocusRepo(repo.fullName);
    if (res?.error) toast.error(res.error);
    else toast.success(`${repo.name} is now your focus repo for the commit goal.`);
  };

  const onToggleDone = async (repo: RepoInfo) => {
    const next = !repo.done;
    setRepos((prev) =>
      prev.map((r) => (r.fullName === repo.fullName ? { ...r, done: next } : r))
    );
    const res = await setRepoDone(repo.fullName, next);
    if (res?.error) toast.error(res.error);
    else
      toast.success(
        next
          ? `${repo.name} marked done — no more push reminders.`
          : `${repo.name} reopened.`
      );
  };

  if (!loading && !connected) {
    return (
      <DashboardLayout>
        <PageHeader
          title="My Repos"
          description="Connect GitHub to see and organize your repositories"
          icon={<Github className="w-5 h-5" />}
        />
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center mb-4">
            <Github className="w-8 h-8 text-white" />
          </div>
          <h3 className="font-semibold text-lg mb-2">GitHub not connected</h3>
          <p className="text-muted-foreground text-sm text-center max-w-sm mb-6">
            Add your GitHub token in Settings to pull in your repositories, track
            commits, and get push reminders.
          </p>
          <Button asChild className="bg-gradient-to-r from-violet-600 to-indigo-600">
            <Link href="/settings">
              Connect GitHub <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="My Repos"
        description="Classify your repos and keep an eye on what needs a push"
        icon={<Github className="w-5 h-5" />}
      />

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <>
          {staleCount > 0 && (
            <div className="flex items-center gap-3 p-4 mb-5 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <p className="text-sm flex-1">
                <span className="font-medium text-amber-700 dark:text-amber-400">
                  {staleCount} repo{staleCount === 1 ? "" : "s"} need a push
                </span>{" "}
                <span className="text-amber-600 dark:text-amber-500">
                  — no commits pushed in {STALE_DAYS}+ days.
                </span>
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setFilter("stale")}
                className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400"
              >
                Show them
              </Button>
            </div>
          )}

          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="mb-5">
            <TabsList>
              <TabsTrigger value="all">All ({repos.length})</TabsTrigger>
              <TabsTrigger value="project">Projects</TabsTrigger>
              <TabsTrigger value="submission">Submissions</TabsTrigger>
              <TabsTrigger value="revision">Revisions</TabsTrigger>
              <TabsTrigger value="stale">Needs Push ({staleCount})</TabsTrigger>
              <TabsTrigger value="done">Done ({doneCount})</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-3">
            {filtered.map((repo) => {
              const d = daysSince(repo.pushedAt);
              const stale = !repo.done && d !== null && d >= STALE_DAYS;
              const isFocus = focusRepo === repo.fullName;
              return (
                <motion.div
                  key={repo.fullName}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card
                    className={cn(
                      isFocus && "border-amber-400 dark:border-amber-700",
                      repo.done && "opacity-60"
                    )}
                  >
                    <CardContent className="p-4 flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {repo.private ? (
                          <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                        ) : (
                          <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                        <a
                          href={repo.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium truncate hover:text-primary inline-flex items-center gap-1"
                        >
                          {repo.name}
                          <ExternalLink className="w-3 h-3 opacity-50" />
                        </a>
                        {repo.language && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {repo.language}
                          </Badge>
                        )}
                        {isFocus && (
                          <Badge className="text-xs shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                            <Target className="w-3 h-3 mr-1" /> Focus
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs shrink-0">
                        {repo.done ? (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Archive className="w-3.5 h-3.5" /> Done — no reminders
                          </span>
                        ) : stale ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="w-3.5 h-3.5" /> Push needed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Up to date
                          </span>
                        )}
                        <span className="text-muted-foreground">
                          {repo.pushedAt ? `· pushed ${timeAgo(repo.pushedAt)}` : "· never pushed"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Select
                          value={repo.category ?? "none"}
                          onValueChange={(v) => onClassify(repo, v)}
                        >
                          <SelectTrigger className="h-8 w-[140px] text-xs">
                            <SelectValue placeholder="Classify…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Unclassified</SelectItem>
                            <SelectItem value="project">Project</SelectItem>
                            <SelectItem value="submission">Submission</SelectItem>
                            <SelectItem value="revision">Revision</SelectItem>
                          </SelectContent>
                        </Select>
                        {!isFocus && !repo.done && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => onSetFocus(repo)}
                          >
                            <Target className="w-3.5 h-3.5 mr-1" /> Focus
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => onToggleDone(repo)}
                        >
                          {repo.done ? (
                            <>
                              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reopen
                            </>
                          ) : (
                            <>
                              <Archive className="w-3.5 h-3.5 mr-1" /> Done
                            </>
                          )}
                        </Button>
                      </div>

                      {repo.category && (
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium",
                            CATEGORY_META[repo.category].color
                          )}
                        >
                          {CATEGORY_META[repo.category].label}
                        </span>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-12">
                No repos in this view.
              </p>
            )}
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

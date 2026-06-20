"use client";

import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "framer-motion";
import { projectDb, projectTaskDb } from "@/lib/db";
import { useJarvisRefresh } from "@/hooks/useJarvisRefresh";
import { importProjectRepos } from "@/app/actions/github";
import { generateId, formatDate } from "@/lib/utils";
import { CodingProject, ProjectStatus } from "@/types";
import { toast } from "sonner";
import {
  FolderKanban,
  Plus,
  Trash2,
  Pencil,
  Github,
  Link2,
  Calendar,
  Check,
  Loader2,
  Rocket,
  ListChecks,
  X,
  CircleDashed,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
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
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageHeader } from "@/components/shared/PageHeader";
import { cn } from "@/lib/utils";

const STATUS_META: Record<
  ProjectStatus,
  { label: string; color: string; dot: string }
> = {
  planning: {
    label: "Planning",
    color:
      "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  "in-progress": {
    label: "In Progress",
    color:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  completed: {
    label: "Completed",
    color:
      "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400",
    dot: "bg-green-500",
  },
  "on-hold": {
    label: "On Hold",
    color:
      "bg-zinc-100 text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400",
    dot: "bg-zinc-400",
  },
};

const PRIORITY_META: Record<string, string> = {
  low: "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400",
  medium:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400",
  high: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",
};

const STATUS_ORDER: ProjectStatus[] = [
  "planning",
  "in-progress",
  "completed",
  "on-hold",
];

interface FormState {
  name: string;
  description: string;
  status: ProjectStatus;
  priority: "low" | "medium" | "high";
  techStack: string;
  repoUrl: string;
  liveUrl: string;
  deadline: string;
  progress: number;
}

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  status: "planning",
  priority: "medium",
  techStack: "",
  repoUrl: "",
  liveUrl: "",
  deadline: "",
  progress: 0,
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<CodingProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | ProjectStatus>("all");
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [syncing, setSyncing] = useState(false);

  const refresh = async () => {
    try {
      setProjects(await projectDb.getAll());
    } catch {
      toast.error("Could not load projects.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useJarvisRefresh(() => refresh());

  const detail = useMemo(
    () => projects.find((p) => p.id === detailId) ?? null,
    [projects, detailId]
  );

  const filtered = useMemo(() => {
    const byStatus =
      filter === "all" ? projects : projects.filter((p) => p.status === filter);
    const q = search.trim().toLowerCase();
    if (!q) return byStatus;
    return byStatus.filter((p) =>
      [p.name, p.description, ...p.techStack]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(q))
    );
  }, [projects, filter, search]);

  const stats = useMemo(
    () => ({
      total: projects.length,
      active: projects.filter((p) => p.status === "in-progress").length,
      completed: projects.filter((p) => p.status === "completed").length,
    }),
    [projects]
  );

  // ----- create / edit -----
  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (p: CodingProject) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      description: p.description,
      status: p.status,
      priority: p.priority,
      techStack: p.techStack.join(", "),
      repoUrl: p.repoUrl ?? "",
      liveUrl: p.liveUrl ?? "",
      deadline: p.deadline ?? "",
      progress: p.progress,
    });
    setDialogOpen(true);
  };

  const saveProject = async () => {
    if (!form.name.trim()) {
      toast.error("Please enter a project name.");
      return;
    }
    setSaving(true);
    try {
      const existing = editingId
        ? projects.find((p) => p.id === editingId)
        : null;
      const project: CodingProject = {
        id: editingId ?? generateId(),
        name: form.name.trim(),
        description: form.description.trim(),
        status: form.status,
        priority: form.priority,
        techStack: form.techStack
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        repoUrl: form.repoUrl.trim() || undefined,
        liveUrl: form.liveUrl.trim() || undefined,
        deadline: form.deadline || undefined,
        progress: form.progress,
        createdAt: existing?.createdAt ?? new Date(),
        updatedAt: new Date(),
        tasks: existing?.tasks ?? [],
      };
      await projectDb.save(project);
      await refresh();
      setDialogOpen(false);
      toast.success(editingId ? "Project updated!" : "Project created!");
    } catch {
      toast.error("Failed to save project.");
    } finally {
      setSaving(false);
    }
  };

  const syncFromGithub = async () => {
    setSyncing(true);
    try {
      const res = await importProjectRepos();
      if (res.error) {
        toast.error(res.error);
      } else if (res.imported && res.imported > 0) {
        await refresh();
        toast.success(
          `Imported ${res.imported} project${res.imported === 1 ? "" : "s"} from GitHub!`
        );
      } else {
        toast.info(res.message ?? "Nothing new to import.");
      }
    } catch {
      toast.error("Sync failed. Is GitHub connected in Settings?");
    } finally {
      setSyncing(false);
    }
  };

  const deleteProject = async (id: string) => {
    try {
      await projectDb.delete(id);
      if (detailId === id) setDetailId(null);
      await refresh();
      toast.success("Project deleted");
    } catch {
      toast.error("Failed to delete project.");
    }
  };

  // ----- tasks -----
  // Keep a project's progress % in sync with its task completion ratio.
  // Only auto-updates when tasks exist — projects without tasks keep the
  // progress set manually via the slider.
  const syncProgressFromTasks = async (
    project: CodingProject,
    tasks: { done: boolean }[]
  ) => {
    if (tasks.length === 0) return;
    const done = tasks.filter((t) => t.done).length;
    const progress = Math.round((done / tasks.length) * 100);
    if (progress !== project.progress) {
      await projectDb.save({ ...project, progress });
    }
  };

  const addTask = async () => {
    if (!detail || !newTaskTitle.trim()) return;
    try {
      const created = await projectTaskDb.add(detail.id, newTaskTitle.trim());
      setNewTaskTitle("");
      await syncProgressFromTasks(detail, [...detail.tasks, created]);
      await refresh();
    } catch {
      toast.error("Failed to add task.");
    }
  };

  const toggleTask = async (taskId: string, done: boolean) => {
    if (!detail) return;
    try {
      await projectTaskDb.toggle(taskId, done);
      const updatedTasks = detail.tasks.map((t) =>
        t.id === taskId ? { ...t, done } : t
      );
      await syncProgressFromTasks(detail, updatedTasks);
      await refresh();
    } catch {
      toast.error("Failed to update task.");
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!detail) return;
    try {
      await projectTaskDb.delete(taskId);
      await syncProgressFromTasks(
        detail,
        detail.tasks.filter((t) => t.id !== taskId)
      );
      await refresh();
    } catch {
      toast.error("Failed to delete task.");
    }
  };

  const taskRatio = (p: CodingProject) => {
    const done = p.tasks.filter((t) => t.done).length;
    return { done, total: p.tasks.length };
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Project Manager"
        description="Track all your coding projects, tech stacks, and to-dos in one place"
        icon={<FolderKanban className="w-5 h-5" />}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={syncFromGithub} disabled={syncing}>
              {syncing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Github className="w-4 h-4 mr-2" />
              )}
              Sync from GitHub
            </Button>
            <Button
              onClick={openCreate}
              className="bg-gradient-to-r from-violet-600 to-indigo-600"
            >
              <Plus className="w-4 h-4 mr-2" /> New Project
            </Button>
          </div>
        }
      />

      {/* Stats */}
      {projects.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Total Projects", value: stats.total, icon: FolderKanban, color: "text-amber-500" },
            { label: "In Progress", value: stats.active, icon: Rocket, color: "text-amber-500" },
            { label: "Completed", value: stats.completed, icon: Check, color: "text-green-500" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <s.icon className={cn("w-5 h-5", s.color)} />
                </div>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Search + filter tabs */}
      {projects.length > 0 && (
        <div className="flex flex-col-reverse gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <Tabs
            value={filter}
            onValueChange={(v) => setFilter(v as "all" | ProjectStatus)}
          >
            <TabsList>
              <TabsTrigger value="all">All ({projects.length})</TabsTrigger>
              {STATUS_ORDER.map((s) => {
                const count = projects.filter((p) => p.status === s).length;
                return (
                  <TabsTrigger key={s} value={s}>
                    {STATUS_META[s].label} ({count})
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, description, tech…"
              className="pl-9 pr-9"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mb-4">
            <FolderKanban className="w-8 h-8 text-white" />
          </div>
          <h3 className="font-semibold text-lg mb-2">No Projects Yet</h3>
          <p className="text-muted-foreground text-sm text-center max-w-sm mb-6">
            Add your coding projects to track their status, tech stack, deadlines,
            and to-do lists — all in one dashboard.
          </p>
          <Button
            onClick={openCreate}
            className="bg-gradient-to-r from-violet-600 to-indigo-600"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Your First Project
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Search className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold mb-1">No matching projects</h3>
          <p className="text-muted-foreground text-sm max-w-sm">
            {search.trim()
              ? `Nothing matches “${search.trim()}”. Try a different search or filter.`
              : "No projects in this category yet."}
          </p>
          {search && (
            <Button variant="outline" className="mt-4" onClick={() => setSearch("")}>
              Clear search
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <AnimatePresence mode="popLayout">
            {filtered.map((p) => {
              const { done, total } = taskRatio(p);
              // Derive progress from task completion when tasks exist, so the
              // bar is always accurate even for tasks toggled before progress
              // sync existed. Projects without tasks use the manual value.
              const progress =
                total > 0 ? Math.round((done / total) * 100) : p.progress;
              return (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  whileHover={{ y: -2 }}
                >
                  <Card className="h-full hover:shadow-lg transition-shadow flex flex-col">
                    <CardContent className="p-5 flex flex-col flex-1">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={cn(
                              "w-2 h-2 rounded-full shrink-0",
                              STATUS_META[p.status].dot
                            )}
                          />
                          <h3 className="font-semibold truncate">{p.name}</h3>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => openEdit(p)}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteProject(p.id)}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {p.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {p.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium",
                            STATUS_META[p.status].color
                          )}
                        >
                          {STATUS_META[p.status].label}
                        </span>
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium capitalize",
                            PRIORITY_META[p.priority]
                          )}
                        >
                          {p.priority}
                        </span>
                      </div>

                      {p.techStack.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {p.techStack.slice(0, 5).map((t) => (
                            <Badge key={t} variant="secondary" className="text-xs">
                              {t}
                            </Badge>
                          ))}
                          {p.techStack.length > 5 && (
                            <Badge variant="secondary" className="text-xs">
                              +{p.techStack.length - 5}
                            </Badge>
                          )}
                        </div>
                      )}

                      <div className="mt-auto space-y-3">
                        <div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>Progress</span>
                            <span>{progress}%</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <button
                            onClick={() => setDetailId(p.id)}
                            className="flex items-center gap-1 hover:text-foreground"
                          >
                            <ListChecks className="w-3.5 h-3.5" />
                            {total > 0 ? `${done}/${total} tasks` : "Add tasks"}
                          </button>
                          {p.deadline && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDate(p.deadline)}
                            </span>
                          )}
                        </div>

                        {(p.repoUrl || p.liveUrl) && (
                          <div className="flex gap-2 pt-1">
                            {p.repoUrl && (
                              <a
                                href={p.repoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                              >
                                <Github className="w-3.5 h-3.5" /> Repo
                              </a>
                            )}
                            {p.liveUrl && (
                              <a
                                href={p.liveUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                              >
                                <Link2 className="w-3.5 h-3.5" /> Live
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Project" : "New Project"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm mb-2 block">Project Name *</Label>
              <Input
                placeholder="e.g., Portfolio Website, Chat App"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-sm mb-2 block">Description</Label>
              <Textarea
                placeholder="What is this project about?"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                className="min-h-[70px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm mb-2 block">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, status: v as ProjectStatus }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_ORDER.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_META[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm mb-2 block">Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      priority: v as "low" | "medium" | "high",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-sm mb-2 block">
                Tech Stack{" "}
                <span className="text-muted-foreground font-normal">
                  (comma separated)
                </span>
              </Label>
              <Input
                placeholder="Next.js, TypeScript, Supabase"
                value={form.techStack}
                onChange={(e) =>
                  setForm((f) => ({ ...f, techStack: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm mb-2 block">Repo URL</Label>
                <Input
                  placeholder="https://github.com/..."
                  value={form.repoUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, repoUrl: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label className="text-sm mb-2 block">Live URL</Label>
                <Input
                  placeholder="https://..."
                  value={form.liveUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, liveUrl: e.target.value }))
                  }
                />
              </div>
            </div>
            <div>
              <Label className="text-sm mb-2 block">Deadline</Label>
              <Input
                type="date"
                value={form.deadline}
                onChange={(e) =>
                  setForm((f) => ({ ...f, deadline: e.target.value }))
                }
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm">Progress</Label>
                <span className="text-sm font-medium">{form.progress}%</span>
              </div>
              <Slider
                value={[form.progress]}
                min={0}
                max={100}
                step={5}
                onValueChange={([v]) =>
                  setForm((f) => ({ ...f, progress: v }))
                }
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={saveProject}
                disabled={saving}
                className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : editingId ? (
                  "Save Changes"
                ) : (
                  "Create Project"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task checklist dialog */}
      <Dialog
        open={!!detail}
        onOpenChange={(open) => !open && setDetailId(null)}
      >
        <DialogContent className="max-w-md">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-amber-500" />
                  {detail.name} — Tasks
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a to-do..."
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addTask()}
                  />
                  <Button onClick={addTask} size="icon" className="shrink-0">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <Separator />
                <ScrollArea className="max-h-[320px]">
                  {detail.tasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No tasks yet. Add your first to-do above.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {detail.tasks.map((t) => (
                        <div
                          key={t.id}
                          className="group flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                        >
                          <button
                            onClick={() => toggleTask(t.id, !t.done)}
                            className={cn(
                              "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                              t.done
                                ? "bg-green-500 border-green-500"
                                : "border-muted-foreground/30 hover:border-primary"
                            )}
                          >
                            {t.done ? (
                              <Check className="w-3 h-3 text-white" />
                            ) : (
                              <CircleDashed className="w-3 h-3 text-transparent" />
                            )}
                          </button>
                          <span
                            className={cn(
                              "flex-1 text-sm",
                              t.done && "line-through text-muted-foreground"
                            )}
                          >
                            {t.title}
                          </span>
                          <button
                            onClick={() => deleteTask(t.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:text-destructive text-muted-foreground"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

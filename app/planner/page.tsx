"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "framer-motion";
import { useSettings } from "@/hooks/useSettings";
import { useStudyData } from "@/hooks/useStudyData";
import { useJarvisRefresh } from "@/hooks/useJarvisRefresh";
import { generateStudyPlan } from "@/lib/ai";
import { taskDb } from "@/lib/db";
import { generateId, formatDate } from "@/lib/utils";
import { StudyTask } from "@/types";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Calendar,
  Plus,
  Trash2,
  Check,
  Loader2,
  Clock,
  Target,
  Sparkles,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const PRIORITY_COLORS = {
  low: "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400",
  high: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400",
};

export default function PlannerPage() {
  const { aiConfig, hasApiKey } = useSettings();
  const { addSession } = useStudyData();
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [showAddTask, setShowAddTask] = useState(false);
  const [aiPlan, setAiPlan] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [newTask, setNewTask] = useState<Partial<StudyTask>>({
    priority: "medium",
    estimatedMinutes: 60,
  });
  const [aiForm, setAiForm] = useState({
    subject: "",
    goal: "",
    timeAvailable: "2 hours per day",
    currentLevel: "intermediate",
  });

  const refreshTasks = async () => setTasks(await taskDb.getAll());

  useEffect(() => {
    refreshTasks().catch(() => {});
  }, []);

  useJarvisRefresh(() => refreshTasks().catch(() => {}));

  const addTask = async () => {
    if (!newTask.title || !newTask.subject || !newTask.dueDate) {
      toast.error("Please fill in title, subject, and due date.");
      return;
    }
    const task: StudyTask = {
      id: generateId(),
      title: newTask.title!,
      subject: newTask.subject!,
      dueDate: newTask.dueDate!,
      priority: newTask.priority as StudyTask["priority"] || "medium",
      completed: false,
      estimatedMinutes: newTask.estimatedMinutes || 60,
      notes: newTask.notes,
    };
    await taskDb.save(task);
    await refreshTasks();
    setShowAddTask(false);
    setNewTask({ priority: "medium", estimatedMinutes: 60 });
    addSession("planner", `Task: ${task.title}`);
    toast.success("Task added!");
  };

  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    await taskDb.save({ ...task, completed: !task.completed });
    await refreshTasks();
  };

  const deleteTask = async (id: string) => {
    await taskDb.delete(id);
    await refreshTasks();
    toast.success("Task deleted");
  };

  const generateAIPlan = async () => {
    if (!aiForm.subject || !aiForm.goal) {
      toast.error("Please fill in subject and goal.");
      return;
    }
    if (!hasApiKey) { toast.error("Please add your Gemini API key in Settings."); return; }

    setIsGenerating(true);
    try {
      const plan = await generateStudyPlan(
        aiConfig,
        aiForm.subject,
        aiForm.goal,
        aiForm.timeAvailable,
        aiForm.currentLevel
      );
      setAiPlan(plan);
      addSession("planner", `AI Plan: ${aiForm.subject}`);
      toast.success("Study plan generated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate plan");
    } finally {
      setIsGenerating(false);
    }
  };

  const completedTasks = tasks.filter(t => t.completed);
  const pendingTasks = tasks.filter(t => !t.completed);
  const progressPercent = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  const sortedPending = [...pendingTasks].sort((a, b) => {
    const p = { high: 3, medium: 2, low: 1 };
    return p[b.priority] - p[a.priority];
  });

  return (
    <DashboardLayout>
      <PageHeader
        title="Study Planner"
        description="Organize your study schedule and generate AI-powered study plans"
        icon={<Calendar className="w-5 h-5" />}
        action={
          <Button onClick={() => setShowAddTask(true)} className="bg-gradient-to-r from-violet-600 to-indigo-600">
            <Plus className="w-4 h-4 mr-2" /> Add Task
          </Button>
        }
      />

      {/* Progress overview */}
      {tasks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"
        >
          <Card className="md:col-span-2">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Overall Progress</h3>
                <span className="text-sm text-muted-foreground">
                  {completedTasks.length}/{tasks.length} tasks
                </span>
              </div>
              <Progress value={progressPercent} className="h-3" />
              <p className="text-xs text-muted-foreground mt-2">{progressPercent}% complete</p>
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-5 text-center">
                <div className="text-2xl font-bold text-orange-500">{pendingTasks.length}</div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 text-center">
                <div className="text-2xl font-bold text-green-500">{completedTasks.length}</div>
                <div className="text-xs text-muted-foreground">Done</div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}

      <Tabs defaultValue="tasks">
        <TabsList className="mb-6">
          <TabsTrigger value="tasks">My Tasks ({tasks.length})</TabsTrigger>
          <TabsTrigger value="ai-plan">AI Study Plan</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks">
          {tasks.length === 0 ? (
            <div className="text-center py-16">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
              <h3 className="font-semibold mb-2">No Tasks Yet</h3>
              <p className="text-muted-foreground text-sm mb-6">Add your first study task to get started.</p>
              <Button onClick={() => setShowAddTask(true)}>
                <Plus className="w-4 h-4 mr-2" /> Add First Task
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Pending */}
              {sortedPending.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-orange-500" /> Pending ({sortedPending.length})
                  </h3>
                  <div className="space-y-3">
                    {sortedPending.map((task) => (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        layout
                      >
                        <Card className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <button
                                onClick={() => toggleTask(task.id)}
                                className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 hover:border-primary flex items-center justify-center mt-0.5 shrink-0 transition-colors"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-sm">{task.title}</span>
                                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", PRIORITY_COLORS[task.priority])}>
                                    {task.priority}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Target className="w-3 h-3" /> {task.subject}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" /> Due: {formatDate(task.dueDate)}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {task.estimatedMinutes} min
                                  </span>
                                </div>
                                {task.notes && (
                                  <p className="text-xs text-muted-foreground mt-1">{task.notes}</p>
                                )}
                              </div>
                              <button
                                onClick={() => deleteTask(task.id)}
                                className="p-1 rounded hover:text-destructive text-muted-foreground"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed */}
              {completedTasks.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" /> Completed ({completedTasks.length})
                  </h3>
                  <div className="space-y-3 opacity-60">
                    {completedTasks.map((task) => (
                      <Card key={task.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => toggleTask(task.id)}
                              className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center mt-0.5 shrink-0"
                            >
                              <Check className="w-3 h-3 text-white" />
                            </button>
                            <div className="flex-1">
                              <span className="font-medium text-sm line-through">{task.title}</span>
                              <div className="text-xs text-muted-foreground mt-0.5">{task.subject}</div>
                            </div>
                            <button onClick={() => deleteTask(task.id)} className="p-1 rounded hover:text-destructive text-muted-foreground">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ai-plan">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" /> Generate AI Study Plan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm mb-2 block">Subject / Topic *</Label>
                  <Input
                    placeholder="e.g., Calculus, World War II, Python Programming"
                    value={aiForm.subject}
                    onChange={(e) => setAiForm(p => ({ ...p, subject: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-sm mb-2 block">Your Goal *</Label>
                  <Textarea
                    placeholder="e.g., Pass my final exam in 3 weeks, learn enough to build a web app"
                    value={aiForm.goal}
                    onChange={(e) => setAiForm(p => ({ ...p, goal: e.target.value }))}
                    className="min-h-[80px]"
                  />
                </div>
                <div>
                  <Label className="text-sm mb-2 block">Time Available Per Day</Label>
                  <Select value={aiForm.timeAvailable} onValueChange={(v) => setAiForm(p => ({ ...p, timeAvailable: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["30 minutes", "1 hour", "2 hours", "3 hours", "4+ hours"].map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm mb-2 block">Current Level</Label>
                  <Select value={aiForm.currentLevel} onValueChange={(v) => setAiForm(p => ({ ...p, currentLevel: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["complete beginner", "beginner", "intermediate", "advanced"].map(l => (
                        <SelectItem key={l} value={l} className="capitalize">{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={generateAIPlan}
                  disabled={!aiForm.subject || !aiForm.goal || isGenerating || !hasApiKey}
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600"
                >
                  {isGenerating ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating Plan...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" /> Generate Study Plan</>
                  )}
                </Button>

                {!hasApiKey && (
                  <p className="text-center text-sm text-muted-foreground">
                    <Link href="/settings" className="text-primary hover:underline">Add your API key</Link> to generate plans.
                  </p>
                )}
              </CardContent>
            </Card>

            <div>
              {aiPlan ? (
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="text-base">Your Personalized Study Plan</CardTitle>
                  </CardHeader>
                  <ScrollArea className="h-[500px]">
                    <CardContent>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiPlan}</ReactMarkdown>
                      </div>
                    </CardContent>
                  </ScrollArea>
                </Card>
              ) : (
                <div className="h-full flex items-center justify-center border rounded-xl border-dashed">
                  <div className="text-center p-8">
                    <Calendar className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="text-muted-foreground text-sm">
                      Fill in the form and generate your personalized AI study plan
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Task Dialog */}
      <Dialog open={showAddTask} onOpenChange={setShowAddTask}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm mb-2 block">Task Title *</Label>
              <Input
                placeholder="e.g., Complete Chapter 5 exercises"
                value={newTask.title || ""}
                onChange={(e) => setNewTask(p => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-sm mb-2 block">Subject *</Label>
              <Input
                placeholder="e.g., Mathematics, History"
                value={newTask.subject || ""}
                onChange={(e) => setNewTask(p => ({ ...p, subject: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm mb-2 block">Due Date *</Label>
                <Input
                  type="date"
                  value={newTask.dueDate || ""}
                  onChange={(e) => setNewTask(p => ({ ...p, dueDate: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-sm mb-2 block">Priority</Label>
                <Select value={newTask.priority || "medium"} onValueChange={(v) => setNewTask(p => ({ ...p, priority: v as StudyTask["priority"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-sm mb-2 block">Estimated Time (minutes)</Label>
              <Input
                type="number"
                min="5"
                max="480"
                value={newTask.estimatedMinutes || 60}
                onChange={(e) => setNewTask(p => ({ ...p, estimatedMinutes: parseInt(e.target.value) }))}
              />
            </div>
            <div>
              <Label className="text-sm mb-2 block">Notes (optional)</Label>
              <Textarea
                placeholder="Any additional notes..."
                value={newTask.notes || ""}
                onChange={(e) => setNewTask(p => ({ ...p, notes: e.target.value }))}
                className="min-h-[60px]"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowAddTask(false)}>
                Cancel
              </Button>
              <Button onClick={addTask} className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600">
                <Plus className="w-4 h-4 mr-2" /> Add Task
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

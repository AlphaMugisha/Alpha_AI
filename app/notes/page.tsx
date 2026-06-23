"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "framer-motion";
import { useSettings } from "@/hooks/useSettings";
import { useStudyData } from "@/hooks/useStudyData";
import { useJarvisRefresh } from "@/hooks/useJarvisRefresh";
import { generateNotes } from "@/lib/ai";
import { answerQuestionPaper } from "@/lib/paper";
import { parseFile, validateFile } from "@/lib/fileParser";
import { notesDb, coursesDb } from "@/lib/db";
import { generateId, formatDate, formatFileSize } from "@/lib/utils";
import { Note, Course } from "@/types";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FileText,
  Upload,
  Loader2,
  Download,
  Trash2,
  Plus,
  X,
  Clock,
  File,
  ClipboardCheck,
  Brain,
  Maximize2,
  Minimize2,
  ArrowLeft,
  ArrowRight,
  FolderOpen,
  GraduationCap,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/PageHeader";
import Link from "next/link";
import { cn } from "@/lib/utils";

const UNCATEGORIZED = "__uncategorized__";

export default function NotesPage() {
  const router = useRouter();
  const { aiConfig, hasApiKey } = useSettings();
  const { addSession } = useStudyData();

  const [notes, setNotes] = useState<Note[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  // View state: course grid → course detail → note viewer / upload.
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // Upload flow.
  const [isGenerating, setIsGenerating] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number; content: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [courseId, setCourseId] = useState<string>("");
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  // "This is a Q&A paper" mode — answer it question-by-question from course notes.
  const [paperMode, setPaperMode] = useState(false);
  const [paperInstructions, setPaperInstructions] = useState("");
  const [answeringPaper, setAnsweringPaper] = useState(false);

  const refreshNotes = async () => {
    const all = await notesDb.getAll();
    setNotes(all);
    return all;
  };

  useEffect(() => {
    refreshNotes().catch(() => {});
    coursesDb.getAll().then(setCourses).catch(() => {});
  }, []);

  useJarvisRefresh(() => {
    refreshNotes().catch(() => {});
    coursesDb.getAll().then(setCourses).catch(() => {});
  });

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const courseName = (id?: string | null) =>
    id === UNCATEGORIZED
      ? "Uncategorized"
      : courses.find((c) => c.id === id)?.name;

  // Notes grouped by course, plus an "Uncategorized" bucket for legacy notes.
  const notesForCourse = (id: string | null) =>
    id === UNCATEGORIZED
      ? notes.filter((n) => !n.courseId)
      : notes.filter((n) => n.courseId === id);

  const courseCards = useMemo(() => {
    const cards = courses.map((c) => ({
      id: c.id,
      name: c.name,
      count: notes.filter((n) => n.courseId === c.id).length,
      latest: notes
        .filter((n) => n.courseId === c.id)
        .reduce<Date | null>(
          (m, n) => (!m || n.createdAt > m ? n.createdAt : m),
          null
        ),
    }));
    const uncategorized = notes.filter((n) => !n.courseId);
    if (uncategorized.length > 0) {
      cards.push({
        id: UNCATEGORIZED,
        name: "Uncategorized",
        count: uncategorized.length,
        latest: uncategorized.reduce<Date | null>(
          (m, n) => (!m || n.createdAt > m ? n.createdAt : m),
          null
        ),
      });
    }
    return cards;
  }, [courses, notes]);

  const detailNotes = selectedCourseId ? notesForCourse(selectedCourseId) : [];

  const createCourse = async () => {
    const name = newCourseName.trim();
    if (!name) return;
    try {
      const course = await coursesDb.create(name);
      setCourses((prev) => [course, ...prev]);
      setCourseId(course.id);
      setNewCourseName("");
      setCreatingCourse(false);
      toast.success(`Course "${course.name}" added.`);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      toast.error(
        code === "23505"
          ? "A course with that name already exists."
          : `Could not create course: ${
              err instanceof Error ? err.message : "unknown error"
            }`
      );
    }
  };

  const openUpload = () => {
    setShowUpload(true);
    setSelectedNote(null);
    setUploadedFile(null);
    setPaperMode(false);
    setPaperInstructions("");
    // Pre-select the course we're currently inside, for convenience.
    if (selectedCourseId && selectedCourseId !== UNCATEGORIZED) {
      setCourseId(selectedCourseId);
    }
  };

  const handleFile = async (file: File) => {
    const error = validateFile(file);
    if (error) { toast.error(error); return; }
    try {
      toast.info("Parsing file...");
      const parsed = await parseFile(file);
      setUploadedFile({ name: parsed.name, size: parsed.size, content: parsed.content });
      toast.success("File loaded! Click 'Generate Notes' to create AI notes.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to parse file");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleGenerate = async () => {
    if (!uploadedFile) { toast.error("Please upload a file first."); return; }
    if (!courseId) { toast.error("Please choose which course this file belongs to."); return; }
    if (!hasApiKey) { toast.error("Please add your Gemini API key in Settings."); return; }

    setIsGenerating(true);
    try {
      const notesContent = await generateNotes(aiConfig, uploadedFile.content, uploadedFile.name);
      const note: Note = {
        id: generateId(),
        title: uploadedFile.name.replace(/\.[^.]+$/, ""),
        content: notesContent,
        sourceFile: uploadedFile.name,
        courseId,
        createdAt: new Date(),
        tags: ["ai-generated"],
      };
      await notesDb.save(note);
      const all = await refreshNotes();
      addSession("notes", note.title);
      toast.success("Notes generated successfully!");
      setUploadedFile(null);
      setShowUpload(false);
      // Drop the user into the course they just added to.
      setSelectedCourseId(courseId);
      setSelectedNote(all.find((n) => n.id === note.id) || note);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate notes");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnswerPaper = async () => {
    if (!uploadedFile) { toast.error("Please upload the question paper first."); return; }
    if (!courseId) { toast.error("Please choose which course this paper belongs to."); return; }
    if (!hasApiKey) { toast.error("Please add your Gemini API key in Settings."); return; }

    setAnsweringPaper(true);
    try {
      const courseNotes = notes
        .filter((n) => n.courseId === courseId)
        .map((n) => `# ${n.title}\n${n.content}`)
        .join("\n\n");
      const cName = courses.find((c) => c.id === courseId)?.name;

      const answers = await answerQuestionPaper(
        aiConfig,
        uploadedFile.content,
        cName,
        courseNotes,
        paperInstructions.trim() || undefined
      );

      const note: Note = {
        id: generateId(),
        title: `Answers — ${uploadedFile.name.replace(/\.[^.]+$/, "")}`,
        content: answers,
        sourceFile: uploadedFile.name,
        courseId,
        createdAt: new Date(),
        tags: ["paper-answers"],
      };
      await notesDb.save(note);
      const all = await refreshNotes();
      addSession("notes", note.title);
      toast.success("Paper answered — walk through it question by question!");
      setUploadedFile(null);
      setShowUpload(false);
      setSelectedCourseId(courseId);
      setSelectedNote(all.find((n) => n.id === note.id) || note);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to answer the paper");
    } finally {
      setAnsweringPaper(false);
    }
  };

  const deleteNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await notesDb.delete(id);
    await refreshNotes();
    if (selectedNote?.id === id) setSelectedNote(null);
    toast.success("Note deleted");
  };

  const exportNote = (note: Note) => {
    const blob = new Blob([note.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${note.title}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Note exported as Markdown");
  };

  const generateExamForAll = () => {
    if (!selectedCourseId || selectedCourseId === UNCATEGORIZED) return;
    if (detailNotes.length === 0) {
      toast.error("Upload some notes for this course first.");
      return;
    }
    if (!hasApiKey) {
      toast.error("Add your Gemini API key in Settings to generate an exam.");
      return;
    }
    toast.info("Building an exam from every note in this course…");
    router.push(`/exam?course=${selectedCourseId}&start=1`);
  };

  // ---------------------------------------------------------------- render
  return (
    <DashboardLayout>
      <PageHeader
        title="Notes Generator"
        description="Upload study materials and get AI-powered structured notes"
        icon={<FileText className="w-5 h-5" />}
      />

      {/* ===================== UPLOAD VIEW ===================== */}
      {showUpload ? (
        <div className="border rounded-xl bg-card p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <Button variant="ghost" size="sm" onClick={() => setShowUpload(false)}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to notes
            </Button>
            <h3 className="text-lg font-semibold">Upload Study Material</h3>
          </div>

          <div className="max-w-xl mx-auto">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all",
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="font-medium mb-1">Drop your file here or click to browse</p>
              <p className="text-sm text-muted-foreground">PDF, DOCX, TXT, MD · Max 10MB</p>
            </div>

            <AnimatePresence>
              {uploadedFile && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-4 p-4 bg-muted/50 rounded-xl flex items-center gap-3"
                >
                  <File className="w-8 h-8 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{uploadedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(uploadedFile.size)}</p>
                  </div>
                  <button onClick={() => setUploadedFile(null)} className="p-1 rounded hover:bg-muted">
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Course selection — every uploaded file must belong to a course */}
            <div className="mt-4">
              <Label className="text-sm mb-2 block">
                Which course is this for? <span className="text-destructive">*</span>
              </Label>
              {creatingCourse ? (
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    placeholder="e.g. Full-Stack JavaScript"
                    value={newCourseName}
                    onChange={(e) => setNewCourseName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") createCourse();
                      if (e.key === "Escape") setCreatingCourse(false);
                    }}
                  />
                  <Button onClick={createCourse} disabled={!newCourseName.trim()}>Add</Button>
                  <Button variant="outline" onClick={() => setCreatingCourse(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Select value={courseId} onValueChange={setCourseId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a course" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          No courses yet — add one
                        </div>
                      ) : (
                        courses.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={() => setCreatingCourse(true)}>
                    <Plus className="w-4 h-4 mr-1" /> New
                  </Button>
                </div>
              )}
            </div>

            {/* Q&A paper mode */}
            <div className="mt-4 flex items-start justify-between gap-4 rounded-xl border p-3">
              <div className="min-w-0">
                <Label className="text-sm">This is a question &amp; answer paper</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Instead of notes, I&apos;ll answer it question by question — in simple language,
                  grounded in this course&apos;s notes.
                </p>
              </div>
              <Switch checked={paperMode} onCheckedChange={setPaperMode} />
            </div>

            {paperMode && (
              <div className="mt-3">
                <Label className="text-sm mb-2 block">
                  Instructions for the AI{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  placeholder="e.g. Only answer section B; explain each step; keep it very beginner-friendly."
                  value={paperInstructions}
                  onChange={(e) => setPaperInstructions(e.target.value)}
                  className="min-h-[70px]"
                />
              </div>
            )}

            {paperMode ? (
              <Button
                onClick={handleAnswerPaper}
                disabled={!uploadedFile || !courseId || answeringPaper || !hasApiKey}
                className="w-full mt-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                size="lg"
              >
                {answeringPaper ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Answering paper…</>
                ) : (
                  <><ClipboardCheck className="w-4 h-4 mr-2" /> Answer this paper</>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleGenerate}
                disabled={!uploadedFile || !courseId || isGenerating || !hasApiKey}
                className="w-full mt-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                size="lg"
              >
                {isGenerating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating Notes...</>
                ) : (
                  <><FileText className="w-4 h-4 mr-2" /> Generate AI Notes</>
                )}
              </Button>
            )}

            {!hasApiKey && (
              <p className="text-center text-sm text-muted-foreground mt-3">
                <Link href="/settings" className="text-primary hover:underline">Add your Gemini API key</Link> to generate notes.
              </p>
            )}
          </div>
        </div>
      ) : selectedNote ? (
        /* ===================== NOTE VIEWER ===================== */
        <div className="border rounded-xl bg-card overflow-hidden flex flex-col h-[calc(100vh-12rem)]">
          <div className="p-4 border-b flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Button variant="ghost" size="sm" onClick={() => setSelectedNote(null)}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="min-w-0">
                <h3 className="font-semibold truncate">{selectedNote.title}</h3>
                <p className="text-xs text-muted-foreground truncate">
                  {courseName(selectedNote.courseId) && `${courseName(selectedNote.courseId)} · `}
                  {formatDate(selectedNote.createdAt)}
                  {selectedNote.sourceFile && ` · ${selectedNote.sourceFile}`}
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => setFullscreen(true)} title="Read full screen">
                <Maximize2 className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => router.push(`/quiz?note=${selectedNote.id}`)}>
                <Brain className="w-4 h-4 mr-2" /> Make Quiz
              </Button>
              <Button
                size="sm"
                className="bg-gradient-to-r from-violet-600 to-indigo-600"
                onClick={() => router.push(`/exam?lesson=${selectedNote.id}`)}
              >
                <ClipboardCheck className="w-4 h-4 mr-2" /> Simulate Exam
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportNote(selectedNote)} title="Export as Markdown">
                <Download className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={(e) => deleteNote(selectedNote.id, e)} title="Delete note">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-6 prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedNote.content}</ReactMarkdown>
            </div>
          </ScrollArea>
        </div>
      ) : selectedCourseId ? (
        /* ===================== COURSE DETAIL ===================== */
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Button variant="ghost" size="sm" onClick={() => setSelectedCourseId(null)}>
                <ArrowLeft className="w-4 h-4 mr-2" /> All courses
              </Button>
              <div className="min-w-0">
                <h2 className="text-xl font-semibold truncate">{courseName(selectedCourseId)}</h2>
                <p className="text-sm text-muted-foreground">
                  {detailNotes.length} {detailNotes.length === 1 ? "note" : "notes"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={openUpload}>
                <Plus className="w-4 h-4 mr-2" /> Add notes
              </Button>
              {selectedCourseId !== UNCATEGORIZED && (
                <Button
                  onClick={generateExamForAll}
                  disabled={detailNotes.length === 0 || !hasApiKey}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                  title={
                    !hasApiKey
                      ? "Add your Gemini API key in Settings"
                      : "Generate one exam covering every note in this course"
                  }
                >
                  <GraduationCap className="w-4 h-4 mr-2" /> Generate exam for all
                </Button>
              )}
            </div>
          </div>

          {detailNotes.length === 0 ? (
            <div className="border rounded-xl bg-card p-12 text-center">
              <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="font-medium mb-1">No notes in this course yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Upload study material to start building this course.
              </p>
              <Button onClick={openUpload}>
                <Plus className="w-4 h-4 mr-2" /> Add notes
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {detailNotes.map((note) => (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelectedNote(note)}
                  className="group relative border rounded-xl bg-card p-4 cursor-pointer transition-all hover:border-primary/40 hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/15 to-indigo-500/15 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-violet-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{note.title}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Clock className="w-3 h-3" /> {formatDate(note.createdAt)}
                      </div>
                      {note.sourceFile && (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {note.sourceFile}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => deleteNote(note.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:text-destructive transition-opacity"
                      title="Delete note"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ===================== COURSE GRID ===================== */
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Your courses</h2>
            <Button onClick={openUpload}>
              <Plus className="w-4 h-4 mr-2" /> New Notes
            </Button>
          </div>

          {courseCards.length === 0 ? (
            <div className="border rounded-xl bg-card p-12 text-center">
              <FolderOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
              <p className="font-medium mb-1">No courses yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Upload study material and assign it to a course to get started.
              </p>
              <Button onClick={openUpload}>
                <Upload className="w-4 h-4 mr-2" /> Upload your first file
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {courseCards.map((c, i) => {
                const isUncat = c.id === UNCATEGORIZED;
                return (
                  <motion.button
                    key={c.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.04 }}
                    whileHover={{ y: -4 }}
                    onClick={() => setSelectedCourseId(c.id)}
                    className="group relative overflow-hidden rounded-2xl border bg-card p-5 text-left shadow-sm transition-colors hover:border-primary/50 hover:shadow-lg"
                  >
                    {/* soft glow on hover */}
                    <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-violet-500/25 to-indigo-500/25 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />

                    <div className="relative flex items-start justify-between">
                      <div
                        className={cn(
                          "flex h-12 w-12 items-center justify-center rounded-xl shadow-sm transition-transform duration-300 group-hover:scale-105",
                          isUncat
                            ? "bg-gradient-to-br from-slate-400 to-slate-600"
                            : "bg-gradient-to-br from-violet-600 to-indigo-600"
                        )}
                      >
                        {isUncat ? (
                          <FolderOpen className="h-6 w-6 text-white" />
                        ) : (
                          <Layers className="h-6 w-6 text-white" />
                        )}
                      </div>
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        {c.count} {c.count === 1 ? "note" : "notes"}
                      </span>
                    </div>

                    <h3 className="relative mt-4 truncate font-semibold transition-colors group-hover:text-primary">
                      {c.name}
                    </h3>

                    <div className="relative mt-1 flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {c.latest ? `Updated ${formatDate(c.latest)}` : "No notes yet"}
                      </p>
                      <span className="flex -translate-x-1 items-center gap-1 text-xs font-medium text-primary opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100">
                        Open <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================== Full-screen reading mode ===================== */}
      <AnimatePresence>
        {fullscreen && selectedNote && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background flex flex-col"
          >
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-b shrink-0">
              <div className="min-w-0">
                <h2 className="font-semibold truncate">{selectedNote.title}</h2>
                <p className="text-xs text-muted-foreground">
                  {courseName(selectedNote.courseId) && `${courseName(selectedNote.courseId)} · `}
                  {formatDate(selectedNote.createdAt)}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-violet-600 to-indigo-600"
                  onClick={() => router.push(`/exam?lesson=${selectedNote.id}`)}
                >
                  <ClipboardCheck className="w-4 h-4 mr-2" /> Simulate Exam
                </Button>
                <Button size="sm" variant="outline" onClick={() => setFullscreen(false)}>
                  <Minimize2 className="w-4 h-4 mr-2" /> Exit full screen
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="mx-auto max-w-3xl px-6 py-10 prose prose-lg dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedNote.content}</ReactMarkdown>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

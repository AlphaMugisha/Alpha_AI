"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "framer-motion";
import { useSettings } from "@/hooks/useSettings";
import { useStudyData } from "@/hooks/useStudyData";
import { generateNotes } from "@/lib/ai";
import { parseFile, validateFile } from "@/lib/fileParser";
import { notesDb, coursesDb } from "@/lib/db";
import { generateId, formatDate, truncate, formatFileSize } from "@/lib/utils";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function NotesPage() {
  const router = useRouter();
  const { aiConfig, hasApiKey } = useSettings();
  const { addSession } = useStudyData();
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number; content: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState<string>("");
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [fullscreen, setFullscreen] = useState(false);

  const refreshNotes = async () => {
    const all = await notesDb.getAll();
    setNotes(all);
    return all;
  };

  useEffect(() => {
    refreshNotes().catch(() => {});
    coursesDb.getAll().then(setCourses).catch(() => {});
  }, []);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const courseName = (id?: string) =>
    courses.find((c) => c.id === id)?.name;

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
      setSelectedNote(all.find(n => n.id === note.id) || note);
      addSession("notes", note.title);
      toast.success("Notes generated successfully!");
      setUploadedFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate notes");
    } finally {
      setIsGenerating(false);
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

  return (
    <DashboardLayout>
      <PageHeader
        title="Notes Generator"
        description="Upload study materials and get AI-powered structured notes"
        icon={<FileText className="w-5 h-5" />}
      />

      <div className="flex h-[calc(100vh-12rem)] gap-4 -mx-0">
        {/* Notes list */}
        <div className="w-72 flex flex-col border rounded-xl bg-card shrink-0">
          <div className="p-3 border-b">
            <Button
              size="sm"
              className="w-full"
              onClick={() => { setSelectedNote(null); setUploadedFile(null); }}
            >
              <Plus className="w-4 h-4 mr-2" /> New Notes
            </Button>
          </div>
          <ScrollArea className="flex-1">
            {notes.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                No notes yet. Upload a file to generate your first notes.
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => setSelectedNote(note)}
                    className={cn(
                      "group p-3 rounded-lg cursor-pointer transition-colors",
                      selectedNote?.id === note.id ? "bg-primary/10 border border-primary/20" : "hover:bg-muted"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{note.title}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(note.createdAt)}
                        </div>
                        {note.sourceFile && (
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {note.sourceFile}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={(e) => deleteNote(note.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0 border rounded-xl bg-card overflow-hidden flex flex-col">
          {selectedNote ? (
            <>
              <div className="p-4 border-b flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{selectedNote.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {courseName(selectedNote.courseId) &&
                      `${courseName(selectedNote.courseId)} · `}
                    {formatDate(selectedNote.createdAt)}
                    {selectedNote.sourceFile && ` · ${selectedNote.sourceFile}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setFullscreen(true)}
                    title="Read full screen"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/quiz?note=${selectedNote.id}`)}
                  >
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
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {selectedNote.content}
                  </ReactMarkdown>
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="w-full max-w-xl">
                <h3 className="text-lg font-semibold mb-4 text-center">Upload Study Material</h3>

                {/* Drop zone */}
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
                      <Button onClick={createCourse} disabled={!newCourseName.trim()}>
                        Add
                      </Button>
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
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        onClick={() => setCreatingCourse(true)}
                      >
                        <Plus className="w-4 h-4 mr-1" /> New
                      </Button>
                    </div>
                  )}
                </div>

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

                {!hasApiKey && (
                  <p className="text-center text-sm text-muted-foreground mt-3">
                    <Link href="/settings" className="text-primary hover:underline">Add your Gemini API key</Link> to generate notes.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full-screen reading mode */}
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
                  {courseName(selectedNote.courseId) &&
                    `${courseName(selectedNote.courseId)} · `}
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
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {selectedNote.content}
                </ReactMarkdown>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

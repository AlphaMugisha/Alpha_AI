"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "framer-motion";
import { useSettings } from "@/hooks/useSettings";
import { useStudyData } from "@/hooks/useStudyData";
import { generateChatResponse, type ChatImage } from "@/lib/ai";
import { generateMixedQuiz } from "@/lib/quiz";
import {
  parseFile,
  validateFile,
  isImageFile,
  fileToBase64,
} from "@/lib/fileParser";
import { chatDb, quizDb } from "@/lib/db";
import { generateId, timeAgo } from "@/lib/utils";
import { Message, ChatSession, Quiz } from "@/types";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  MessageCircle,
  Send,
  Copy,
  Plus,
  Trash2,
  User,
  Settings,
  Loader2,
  Check,
  Paperclip,
  FileText,
  Image as ImageIcon,
  X,
  GraduationCap,
  Sparkles,
  ArrowRight,
  Atom,
  Landmark,
  Sigma,
  BrainCircuit,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { cn } from "@/lib/utils";

function CopyButton({ text, light = false }: { text: string; light?: boolean }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      title="Copy"
      className={cn(
        "p-1.5 rounded-md transition-all",
        light
          ? "text-white/70 hover:text-white hover:bg-white/15"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-500" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn("group flex gap-3", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 mt-0.5 shadow-md shadow-violet-500/20 ring-1 ring-white/10">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
      )}
      <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start", "min-w-0")}>
        <div
          className={cn(
            "relative",
            isUser
              ? "max-w-[85%] rounded-2xl rounded-tr-md px-4 py-2.5 bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/20"
              : "max-w-[85%] rounded-2xl rounded-tl-md border bg-card px-4 py-3 shadow-sm"
          )}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    const codeStr = String(children).replace(/\n$/, "");
                    return match ? (
                      <div className="relative group/code my-3">
                        <div className="absolute right-2 top-2 z-10 opacity-0 group-hover/code:opacity-100 transition-opacity">
                          <CopyButton text={codeStr} light />
                        </div>
                        <SyntaxHighlighter
                          style={oneDark}
                          language={match[1]}
                          PreTag="div"
                          className="!rounded-lg !text-xs"
                        >
                          {codeStr}
                        </SyntaxHighlighter>
                      </div>
                    ) : (
                      <code
                        className="bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        {/* Meta row — timestamp + copy, revealed on hover */}
        <div
          className={cn(
            "flex items-center gap-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity",
            isUser ? "flex-row-reverse" : "flex-row"
          )}
        >
          <span className="text-[11px] text-muted-foreground">
            {timeAgo(message.timestamp)}
          </span>
          {!isUser && <CopyButton text={message.content} />}
        </div>
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-xl bg-secondary border flex items-center justify-center shrink-0 mt-0.5">
          <User className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
    </motion.div>
  );
}

interface Attachment {
  id: string;
  name: string;
  kind: "image" | "file";
  size: number;
  mimeType?: string; // images
  base64?: string; // images (no data: prefix)
  dataUrl?: string; // images (preview)
  text?: string; // parsed text from docs
}

export default function ChatPage() {
  const router = useRouter();
  const { aiConfig, hasApiKey } = useSettings();
  const { addSession } = useStudyData();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attaching, setAttaching] = useState(false);
  const [makingQuiz, setMakingQuiz] = useState(false);
  // Extracted text from every doc attached this session — fed to the model as
  // reference material and used as the source when generating a quiz.
  const [knowledge, setKnowledge] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatDb.getAll().then(setSessions).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const currentSession = sessions.find((s) => s.id === currentSessionId);

  const newChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setAttachments([]);
    setKnowledge("");
  };

  const handleAttach = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAttaching(true);
    try {
      for (const file of Array.from(files)) {
        const error = validateFile(file, true);
        if (error) {
          toast.error(`${file.name}: ${error}`);
          continue;
        }
        if (isImageFile(file)) {
          const base64 = await fileToBase64(file);
          setAttachments((prev) => [
            ...prev,
            {
              id: generateId(),
              name: file.name,
              kind: "image",
              size: file.size,
              mimeType: file.type || "image/png",
              base64,
              dataUrl: `data:${file.type || "image/png"};base64,${base64}`,
            },
          ]);
        } else {
          const parsed = await parseFile(file);
          setAttachments((prev) => [
            ...prev,
            {
              id: generateId(),
              name: file.name,
              kind: "file",
              size: file.size,
              text: parsed.content,
            },
          ]);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to attach file");
    } finally {
      setAttaching(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeAttachment = (id: string) =>
    setAttachments((prev) => prev.filter((a) => a.id !== id));

  const generateQuizFromChat = async () => {
    if (!hasApiKey) {
      toast.error("Add your Gemini API key in Settings first.");
      return;
    }
    const transcript = messages
      .map((m) => `${m.role === "user" ? "Student" : "Alpha"}: ${m.content}`)
      .join("\n\n");
    const content = [knowledge, transcript].filter(Boolean).join("\n\n---\n\n");
    if (!content.trim()) {
      toast.error("Chat about something first, then I can build a quiz from it.");
      return;
    }
    setMakingQuiz(true);
    try {
      const questions = await generateMixedQuiz(aiConfig, content);
      const title =
        (messages.find((m) => m.role === "user")?.content ?? "Chat").slice(0, 50) +
        " — Quiz";
      const quiz: Quiz = {
        id: generateId(),
        title,
        questions,
        sourceContent: content.slice(0, 500),
        createdAt: new Date(),
      };
      await quizDb.save(quiz);
      addSession("quiz", quiz.title);
      toast.success(`Quiz ready — ${questions.length} questions!`);
      router.push(`/quiz?id=${quiz.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate quiz");
    } finally {
      setMakingQuiz(false);
    }
  };

  const loadSession = (session: ChatSession) => {
    setCurrentSessionId(session.id);
    setMessages(session.messages.map(m => ({
      ...m,
      timestamp: new Date(m.timestamp),
    })));
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await chatDb.delete(id);
    setSessions(await chatDb.getAll());
    if (currentSessionId === id) newChat();
  };

  const sendMessage = useCallback(async () => {
    if ((!input.trim() && attachments.length === 0) || isLoading) return;
    if (!hasApiKey) {
      toast.error("Please add your Gemini API key in Settings first.");
      return;
    }

    const images: ChatImage[] = attachments
      .filter((a) => a.kind === "image" && a.base64)
      .map((a) => ({ mimeType: a.mimeType || "image/png", data: a.base64! }));
    const newFileText = attachments
      .filter((a) => a.kind === "file" && a.text)
      .map((a) => `# ${a.name}\n${a.text}`)
      .join("\n\n");

    const promptText =
      input.trim() ||
      (images.length
        ? "Please read the attached image(s) and help me."
        : "Please read the attached material and help me.");

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: promptText,
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setAttachments([]);
    setIsLoading(true);

    // Keep doc text around for quiz generation later.
    if (newFileText) {
      setKnowledge((k) => [k, newFileText].filter(Boolean).join("\n\n"));
    }

    try {
      // Inject this turn's attached doc text into the final user turn only.
      const augmented = newFileText
        ? `${promptText}\n\n--- Attached material ---\n${newFileText.slice(0, 12000)}`
        : promptText;

      const history = newMessages.map((m, i) => ({
        role: m.role === "user" ? ("user" as const) : ("model" as const),
        parts: [
          { text: i === newMessages.length - 1 ? augmented : m.content },
        ],
      }));

      const responseText = await generateChatResponse(
        aiConfig,
        history,
        undefined,
        images.length ? images : undefined
      );

      const assistantMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: responseText,
        timestamp: new Date(),
      };

      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);

      const sessionTitle = userMessage.content.slice(0, 50);
      let sessionId = currentSessionId;

      if (!sessionId) {
        sessionId = generateId();
        setCurrentSessionId(sessionId);
        addSession("chat", sessionTitle);
      }

      const session: ChatSession = {
        id: sessionId,
        title: sessionTitle,
        messages: finalMessages,
        createdAt: currentSession?.createdAt || new Date(),
        updatedAt: new Date(),
      };
      await chatDb.save(session);
      setSessions(await chatDb.getAll());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to get response");
    } finally {
      setIsLoading(false);
    }
  }, [input, attachments, isLoading, hasApiKey, messages, aiConfig, currentSessionId, currentSession, addSession]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const starters = [
    { text: "Explain quantum entanglement in simple terms", icon: Atom },
    { text: "Help me understand the French Revolution", icon: Landmark },
    { text: "What are the key concepts in calculus?", icon: Sigma },
    { text: "How does machine learning work?", icon: BrainCircuit },
  ];

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-8rem)] gap-4 -m-6">
        {/* Sidebar */}
        <div className="w-64 border-r flex flex-col bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-sm shrink-0">
          {/* Brand */}
          <div className="flex items-center gap-2.5 px-4 py-4 border-b">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-md shadow-violet-500/25">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">Alpha Chat</p>
              <p className="text-[11px] text-muted-foreground leading-tight">AI study assistant</p>
            </div>
          </div>
          <div className="p-3">
            <Button
              onClick={newChat}
              className="w-full bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-sm"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" /> New Chat
            </Button>
          </div>
          {sessions.length > 0 && (
            <p className="px-4 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Recent
            </p>
          )}
          <ScrollArea className="flex-1">
            <div className="p-2 pt-0 space-y-0.5">
              {sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center px-4 py-10 text-muted-foreground">
                  <MessageCircle className="w-6 h-6 mb-2 opacity-40" />
                  <p className="text-xs">No conversations yet.</p>
                </div>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => loadSession(session)}
                    className={cn(
                      "group flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors",
                      currentSessionId === session.id
                        ? "bg-gradient-to-r from-violet-500/15 to-indigo-500/10 text-foreground ring-1 ring-violet-500/20"
                        : "hover:bg-muted"
                    )}
                  >
                    <MessageCircle
                      className={cn(
                        "w-4 h-4 shrink-0",
                        currentSessionId === session.id ? "text-violet-500" : "opacity-50"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{session.title}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {timeAgo(new Date(session.updatedAt))}
                      </p>
                    </div>
                    <button
                      onClick={(e) => deleteSession(session.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                      aria-label="Delete chat"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {(messages.length > 0 || knowledge) && (
            <div className="flex items-center justify-between gap-3 px-6 py-3 border-b bg-card/60 backdrop-blur-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-sm font-medium truncate">
                  {currentSession?.title ?? "New conversation"}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={generateQuizFromChat}
                disabled={makingQuiz || !hasApiKey}
                title="Generate a mixed quiz (multiple-choice + open-ended) from this chat"
                className="border-violet-500/30 hover:border-violet-500/60 hover:bg-violet-500/5"
              >
                {makingQuiz ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Building quiz…</>
                ) : (
                  <><GraduationCap className="w-4 h-4 mr-2 text-violet-500" /> Generate quiz</>
                )}
              </Button>
            </div>
          )}
          <ScrollArea className="flex-1 p-6">
            {messages.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center justify-center h-full py-12"
              >
                <div className="relative mb-5">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 blur-xl opacity-40" />
                  <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-2">
                  How can I help you <span className="gradient-text">study</span>?
                </h3>
                <p className="text-muted-foreground text-sm text-center max-w-md mb-8">
                  Your AI study assistant powered by Google Gemini. Ask anything, attach notes or images, or start with a prompt below.
                </p>
                {!hasApiKey && (
                  <Card className="p-4 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 mb-6 max-w-sm">
                    <p className="text-sm text-amber-700 dark:text-amber-400 text-center">
                      Add your Gemini API key in{" "}
                      <Link href="/settings" className="font-semibold underline">Settings</Link>{" "}
                      to start chatting.
                    </p>
                  </Card>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                  {starters.map((s, i) => (
                    <motion.button
                      key={s.text}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                      onClick={() => setInput(s.text)}
                      className="group flex items-center gap-3 text-left p-3.5 rounded-xl border bg-card/50 hover:border-violet-500/50 hover:bg-violet-500/5 hover:shadow-sm text-sm transition-all"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/10 to-indigo-500/10 text-violet-500 group-hover:from-violet-500 group-hover:to-indigo-600 group-hover:text-white transition-colors">
                        <s.icon className="w-4 h-4" />
                      </span>
                      <span className="flex-1 leading-snug">{s.text}</span>
                      <ArrowRight className="w-4 h-4 shrink-0 text-muted-foreground/0 group-hover:text-violet-500 -translate-x-1 group-hover:translate-x-0 transition-all" />
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <div className="space-y-5 max-w-3xl mx-auto">
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3"
                  >
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 mt-0.5 shadow-md shadow-violet-500/20 ring-1 ring-white/10">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div className="rounded-2xl rounded-tl-md border bg-card px-4 py-3.5 shadow-sm">
                      <div className="flex gap-1.5">
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
                            transition={{ repeat: Infinity, delay: i * 0.15, duration: 0.7 }}
                            className="w-2 h-2 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600"
                          />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t bg-gradient-to-t from-card/70 to-transparent">
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md,image/*"
              className="hidden"
              onChange={(e) => handleAttach(e.target.files)}
            />

            {/* Attachment chips */}
            {attachments.length > 0 && (
              <div className="max-w-3xl mx-auto mb-2 flex flex-wrap gap-2">
                {attachments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 rounded-lg border bg-background pl-1.5 pr-2 py-1 text-xs"
                  >
                    {a.kind === "image" && a.dataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.dataUrl}
                        alt={a.name}
                        className="h-7 w-7 rounded object-cover"
                      />
                    ) : a.kind === "image" ? (
                      <ImageIcon className="h-4 w-4 text-primary" />
                    ) : (
                      <FileText className="h-4 w-4 text-primary" />
                    )}
                    <span className="max-w-[140px] truncate">{a.name}</span>
                    <button
                      onClick={() => removeAttachment(a.id)}
                      className="rounded p-0.5 hover:text-destructive"
                      aria-label="Remove attachment"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="max-w-3xl mx-auto flex items-end gap-2 rounded-2xl border bg-background p-2 shadow-sm focus-within:border-violet-500/50 focus-within:ring-2 focus-within:ring-violet-500/10 transition-all">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileRef.current?.click()}
                disabled={attaching || isLoading}
                title="Attach images or files (PDF, DOCX, TXT, MD)"
                className="h-10 w-10 shrink-0 rounded-xl text-muted-foreground hover:text-violet-500 hover:bg-violet-500/5"
              >
                {attaching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Paperclip className="w-4 h-4" />
                )}
              </Button>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything, or attach an image/file and prompt it… (Shift+Enter for new line)"
                className="min-h-[40px] max-h-32 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 px-1"
                rows={1}
              />
              <Button
                onClick={sendMessage}
                disabled={(!input.trim() && attachments.length === 0) || isLoading}
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            {!hasApiKey && (
              <p className="text-center text-xs text-muted-foreground mt-2">
                <Link href="/settings" className="text-primary hover:underline flex items-center justify-center gap-1">
                  <Settings className="w-3 h-3" /> Configure your Gemini API key to start chatting
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

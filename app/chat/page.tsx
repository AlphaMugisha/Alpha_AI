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
  Bot,
  User,
  Settings,
  Loader2,
  Check,
  Paperclip,
  FileText,
  Image as ImageIcon,
  X,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { cn } from "@/lib/utils";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-muted"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 mt-1">
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}
      <div
        className={cn(
          "group relative",
          isUser
            ? "max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-3 bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-sm"
            : "max-w-[85%] rounded-2xl rounded-tl-sm border bg-card px-4 py-3 shadow-sm"
        )}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const codeStr = String(children).replace(/\n$/, "");
                  return match ? (
                    <div className="relative group/code my-3">
                      <div className="absolute right-2 top-2 z-10">
                        <CopyButton text={codeStr} />
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
        <div className="flex items-center justify-between mt-1 gap-2">
          <span className={cn("text-xs opacity-50", isUser ? "text-primary-foreground" : "text-foreground")}>
            {timeAgo(message.timestamp)}
          </span>
          {!isUser && <CopyButton text={message.content} />}
        </div>
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-1">
          <User className="w-4 h-4" />
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
    "Explain quantum entanglement in simple terms",
    "Help me understand the French Revolution",
    "What are the key concepts in calculus?",
    "How does machine learning work?",
  ];

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-8rem)] gap-4 -m-6">
        {/* Sidebar */}
        <div className="w-64 border-r flex flex-col bg-card/50 shrink-0">
          <div className="p-3 border-b">
            <Button onClick={newChat} className="w-full" size="sm">
              <Plus className="w-4 h-4 mr-2" /> New Chat
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => loadSession(session)}
                  className={cn(
                    "group flex items-center gap-2 p-2.5 rounded-lg cursor-pointer text-sm transition-colors",
                    currentSessionId === session.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted"
                  )}
                >
                  <MessageCircle className="w-4 h-4 shrink-0 opacity-60" />
                  <span className="truncate flex-1 text-xs">{session.title}</span>
                  <button
                    onClick={(e) => deleteSession(session.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {(messages.length > 0 || knowledge) && (
            <div className="flex items-center justify-between gap-3 px-6 py-3 border-b bg-card/50">
              <div className="flex items-center gap-2 min-w-0">
                <Bot className="w-4 h-4 text-primary shrink-0" />
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
              >
                {makingQuiz ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Building quiz…</>
                ) : (
                  <><GraduationCap className="w-4 h-4 mr-2" /> Generate quiz</>
                )}
              </Button>
            </div>
          )}
          <ScrollArea className="flex-1 p-6">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mb-4">
                  <Bot className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2">Alpha Chat</h3>
                <p className="text-muted-foreground text-sm text-center max-w-md mb-8">
                  Your AI study assistant powered by Google Gemini. Ask anything about any subject.
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
                <div className="grid grid-cols-2 gap-3 max-w-lg">
                  {starters.map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="text-left p-3 rounded-xl border hover:border-primary/50 hover:bg-muted/50 text-sm transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6 max-w-3xl mx-auto">
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex gap-3"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="pt-2">
                      <div className="flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            animate={{ y: [0, -6, 0] }}
                            transition={{ repeat: Infinity, delay: i * 0.15, duration: 0.6 }}
                            className="w-2 h-2 rounded-full bg-muted-foreground/50"
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
          <div className="p-4 border-t bg-card/50">
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

            <div className="max-w-3xl mx-auto flex items-end gap-2 rounded-2xl border bg-background p-2 shadow-sm focus-within:border-primary/50 transition-colors">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileRef.current?.click()}
                disabled={attaching || isLoading}
                title="Attach images or files (PDF, DOCX, TXT, MD)"
                className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
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

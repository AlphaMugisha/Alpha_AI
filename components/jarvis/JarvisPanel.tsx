"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useJarvis, type JarvisState } from "@/context/JarvisContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Mic,
  Pause,
  Volume2,
  VolumeX,
  Square,
  Send,
  Loader2,
  Sparkles,
  X,
  Eraser,
  Radio,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function JarvisPanel() {
  const j = useJarvis();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [j.messages, j.thinking, j.transcript]);

  const send = () => {
    if (!draft.trim()) return;
    j.ask(draft);
    setDraft("");
  };

  return (
    <AnimatePresence>
      {j.open && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
          className="fixed bottom-4 right-4 z-[90] w-[calc(100vw-2rem)] sm:w-96 rounded-2xl border bg-card shadow-2xl shadow-violet-500/10 overflow-hidden flex flex-col max-h-[70vh]"
        >
          {/* Header */}
          <div className="flex items-center gap-2 p-3 border-b bg-gradient-to-r from-violet-600/10 to-indigo-600/10">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold">Jarvis</div>
              <div className="text-[10px] text-muted-foreground -mt-0.5">{stateLabel(j.state)}</div>
            </div>
            <div className="ml-auto flex items-center gap-0.5">
              {j.wakeSupported && (
                <button
                  onClick={() => j.setHandsFree(!j.handsFree)}
                  className={cn(
                    "p-1.5 rounded-md hover:bg-muted",
                    j.handsFree
                      ? "text-violet-600 dark:text-violet-400"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title={j.handsFree ? 'Hands-free on — say "Hey Jarvis"' : 'Enable "Hey Jarvis" wake word'}
                >
                  <Radio className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => j.setAutoSpeak(!j.autoSpeak)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                title={j.autoSpeak ? "Mute Jarvis" : "Unmute Jarvis"}
              >
                {j.autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <button
                onClick={j.clearChat}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                title="Clear conversation"
              >
                <Eraser className="w-4 h-4" />
              </button>
              <button
                onClick={() => j.setOpen(false)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Orb */}
          <div className="flex flex-col items-center pt-4 pb-2 shrink-0">
            <Orb state={j.state} />
            <p className="text-[11px] text-muted-foreground mt-1.5 h-4">
              {j.state === "listening"
                ? "Listening… just talk"
                : j.state === "thinking"
                  ? "Thinking…"
                  : j.state === "speaking"
                    ? "Speaking…"
                    : j.live
                      ? "Listening — go ahead"
                      : "Paused — tap the mic to resume"}
            </p>
          </div>

          {/* Conversation */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 min-h-[120px]">
            <div className="space-y-2.5 pb-2">
              {j.messages.map((m, i) => (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                      m.role === "user"
                        ? "bg-violet-600 text-white rounded-br-sm"
                        : "bg-muted rounded-bl-sm"
                    )}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {j.transcript && (
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl px-3 py-2 text-sm bg-violet-600/50 text-white italic rounded-br-sm">
                    {j.transcript}
                  </div>
                </div>
              )}
              {j.thinking && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {!j.hasApiKey && (
            <div className="mx-3 mb-2 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>
                <Link href="/settings" className="underline">Add an API key</Link> so Jarvis can reply.
              </span>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-2 p-3 border-t shrink-0">
            {j.micSupported && (
              <Button
                type="button"
                size="icon"
                onClick={() => (j.live ? j.pauseListening() : j.resumeListening())}
                className={cn(
                  "shrink-0 rounded-full",
                  j.live
                    ? j.listening
                      ? "bg-red-500 hover:bg-red-600 animate-pulse"
                      : "bg-gradient-to-br from-violet-600 to-indigo-600"
                    : "bg-muted text-foreground hover:bg-muted/70"
                )}
                title={j.live ? "Pause listening" : "Resume listening"}
              >
                {j.live ? <Pause className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
            )}
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={j.stopConversation}
              className="shrink-0 rounded-full"
              title="Stop — end the conversation"
            >
              <Square className="w-4 h-4" />
            </Button>
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Talk or type to Jarvis…"
              className="flex-1 h-9"
            />
            <Button type="button" size="icon" className="shrink-0 h-9 w-9" disabled={!draft.trim() || j.thinking} onClick={send}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function stateLabel(state: JarvisState): string {
  return state === "listening"
    ? "Listening…"
    : state === "thinking"
      ? "Thinking…"
      : state === "speaking"
        ? "Speaking…"
        : "Online";
}

function Orb({ state }: { state: JarvisState }) {
  const color =
    state === "listening"
      ? "from-red-500 to-rose-600"
      : state === "thinking"
        ? "from-amber-500 to-orange-600"
        : "from-violet-600 to-indigo-600";
  const active = state === "speaking" || state === "listening";
  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      {active &&
        [0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className={cn("absolute rounded-full bg-gradient-to-br opacity-30", color)}
            initial={{ width: 40, height: 40, opacity: 0.4 }}
            animate={{ width: 64, height: 64, opacity: 0 }}
            transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.45, ease: "easeOut" }}
          />
        ))}
      <motion.div
        animate={state === "idle" ? { scale: [1, 1.04, 1] } : { scale: [1, 1.12, 1] }}
        transition={{ duration: state === "idle" ? 3 : 1, repeat: Infinity }}
        className={cn("relative w-11 h-11 rounded-full bg-gradient-to-br shadow-lg flex items-center justify-center", color)}
      >
        <Sparkles className="w-5 h-5 text-white" />
      </motion.div>
    </div>
  );
}

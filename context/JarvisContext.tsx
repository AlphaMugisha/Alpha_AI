"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { useSpeechRecognition } from "@/hooks/useSpeech";
import { useVoice } from "@/hooks/useVoice";
import { useWakeWord } from "@/hooks/useWakeWord";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { describeScreen } from "@/lib/jarvis/screen";
import type { Inventory } from "@/lib/jarvis/actions";
import { toast } from "sonner";
import dynamic from "next/dynamic";

// Client-only UI, lazy-loaded (pulls framer-motion etc.) so it never touches
// the critical path of unauthenticated pages — it only loads once a user exists.
const JarvisPanel = dynamic(
  () => import("@/components/jarvis/JarvisPanel").then((m) => m.JarvisPanel),
  { ssr: false }
);
const JarvisStatusPill = dynamic(
  () => import("@/components/jarvis/JarvisStatusPill").then((m) => m.JarvisStatusPill),
  { ssr: false }
);

// NOTE: the AI SDKs, coach analytics and gamification graph are intentionally
// NOT imported statically here. This provider sits in the ROOT layout (so Jarvis
// persists across navigation), and static imports would pull all of that heavy
// code into the initial bundle of EVERY page (incl. landing/login). Instead we
// dynamic-import them only when the user actually opens / talks to Jarvis.

export type JarvisState = "idle" | "listening" | "thinking" | "speaking";
type Msg = { role: "user" | "assistant"; text: string };
type GeminiHistory = { role: "user" | "model"; parts: { text: string }[] }[];

interface JarvisValue {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  messages: Msg[];
  thinking: boolean;
  ask: (text: string) => void;
  clearChat: () => void;
  autoSpeak: boolean;
  setAutoSpeak: (v: boolean) => void;
  handsFree: boolean;
  setHandsFree: (v: boolean) => void;
  wakeSupported: boolean;
  state: JarvisState;
  speaking: boolean;
  stopSpeaking: () => void;
  listening: boolean;
  transcript: string;
  live: boolean;
  pauseListening: () => void;
  resumeListening: () => void;
  stopConversation: () => void;
  micSupported: boolean;
  hasApiKey: boolean;
}

const Ctx = createContext<JarvisValue | null>(null);

export function useJarvis() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useJarvis must be used within JarvisProvider");
  return ctx;
}

export function JarvisProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const { aiConfig, hasApiKey } = useSettings();
  const pathname = usePathname();
  const router = useRouter();
  const firstName = profile?.full_name?.trim().split(" ")[0] ?? null;

  const [open, setOpenState] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [thinking, setThinking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [handsFree, setHandsFreeRaw] = useLocalStorage("jarvis_handsfree", false);
  // Continuous conversation mode: when live, Jarvis keeps listening so the user
  // can just talk back-and-forth without tapping a mic. Pause/Stop control it.
  const [live, setLive] = useState(false);

  const snapshotPromptRef = useRef<string | null>(null);
  const memoryRef = useRef<string[]>([]);
  // Jarvis's "hands": the lazily-loaded actions module, a live inventory of the
  // user's items (for resolving names → ids), and its prompt-formatted form.
  const actionsModRef = useRef<typeof import("@/lib/jarvis/actions") | null>(null);
  const inventoryRef = useRef<Inventory | null>(null);
  const inventoryPromptRef = useRef<string | null>(null);
  const greetedRef = useRef(false);
  const askRef = useRef<(t: string) => void>(() => {});
  const messagesRef = useRef<Msg[]>([]);
  const initPromiseRef = useRef<Promise<void> | null>(null);
  // Refs read by speech callbacks (avoid stale closures in the listen loop).
  const liveRef = useRef(false);
  const openRef = useRef(false);
  const thinkingRef = useRef(false);
  const gotFinalRef = useRef(false);
  const startListenRef = useRef<() => void>(() => {});

  const tts = useVoice();
  const stt = useSpeechRecognition({
    onFinal: (t) => {
      gotFinalRef.current = true;
      askRef.current(t);
    },
    onEnd: () => {
      // The user spoke → the ask→reply→speak chain will re-open the mic.
      if (gotFinalRef.current) {
        gotFinalRef.current = false;
        return;
      }
      // Silence/timeout → if still live & idle, keep listening.
      if (liveRef.current && openRef.current && !thinkingRef.current && !tts.speaking) {
        window.setTimeout(() => {
          if (liveRef.current && openRef.current) startListenRef.current();
        }, 500);
      }
    },
  });

  liveRef.current = live;
  openRef.current = open;
  thinkingRef.current = thinking;

  // Cancel TTS and (re)start the command mic for the next conversation turn.
  const startListening = useCallback(() => {
    tts.cancel();
    stt.start();
  }, [tts, stt]);
  startListenRef.current = startListening;

  const continueLive = useCallback(() => {
    if (liveRef.current && openRef.current) startListenRef.current();
  }, []);

  // Reset cached context when the user changes (login/logout).
  useEffect(() => {
    initPromiseRef.current = null;
    snapshotPromptRef.current = null;
    memoryRef.current = [];
    inventoryRef.current = null;
    inventoryPromptRef.current = null;
    if (!user) {
      setLive(false);
      setOpenState(false);
      stt.stop();
      tts.cancel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Lazily load Jarvis's memory + the user's study snapshot — only once, and
  // only when Jarvis is first used. Heavy modules are dynamic-imported here.
  const ensureContext = useCallback(() => {
    if (!user) return Promise.resolve();
    if (initPromiseRef.current) return initPromiseRef.current;
    initPromiseRef.current = (async () => {
      try {
        const [memMod, dbMod, analyticsMod, actionsMod] = await Promise.all([
          import("@/lib/jarvis/memory"),
          import("@/lib/coach/db"),
          import("@/lib/coach/analytics"),
          import("@/lib/jarvis/actions"),
        ]);
        actionsModRef.current = actionsMod;
        const [facts, raw, inventory] = await Promise.all([
          memMod.getJarvisMemory(),
          dbMod.loadCoachData(firstName),
          actionsMod.loadInventory(),
        ]);
        memoryRef.current = facts;
        snapshotPromptRef.current = analyticsMod.snapshotToPrompt(
          analyticsMod.computeSnapshot(raw)
        );
        inventoryRef.current = inventory;
        inventoryPromptRef.current = actionsMod.inventoryToPrompt(inventory);
      } catch {
        // best-effort context
      }
    })();
    return initPromiseRef.current;
  }, [user, firstName]);

  const buildSystemPrompt = useCallback(() => {
    const screen = describeScreen(pathname || "");
    const facts = memoryRef.current;
    const snap = snapshotPromptRef.current;
    const actionsPrompt = actionsModRef.current?.ACTIONS_PROMPT ?? "";
    const inventory = inventoryPromptRef.current;
    return `You are JARVIS — ${firstName || "the user"}'s personal AI companion and mentor, inspired by Tony Stark's assistant. You're a friend first, a sharp tutor when needed, and a proactive helper who quietly takes care of things. You are NOT a chatbot, a command parser, or a search engine.

Personality:
- Warm, clever, quick-witted. You enjoy friendly banter and light jokes, and you can be playfully sarcastic in a kind way.
- You genuinely care about ${firstName || "the user"}. Talk like a real person who knows them, not a corporate bot.
- You can chat about ANYTHING — jokes, life, motivation, random questions — not just studying. When they want help studying or want something done in the app, switch smoothly into a sharp, capable assistant.
- Be proactive: if something obviously needs doing or following up, offer it or just do it.

How to understand what they mean (MOST IMPORTANT):
- Listen for INTENT, not exact words. People speak casually, with typos, slang, half-sentences and vague phrasing — understand the meaning behind it, like a smart human assistant would.
- Map natural descriptions to the real thing. "my bio cards" / "that deck" / "the flashcards from earlier" all mean a flashcard deck in their items below — match it by meaning, not by an exact string. "the planner thing", "my to-dos", "tasks" all mean study tasks. "make a test on X" means create a quiz.
- Resolve references from context: "that", "it", "this one", "the thing we just did", "the one from earlier" usually refer to the most recent thing in THIS conversation or the screen they're on. Use the conversation so far and their current screen to figure out the target.
- "open / show / take me to / go to / where's the …" means navigate to that page, even if they don't use its exact name (e.g. "where I make notes" → notes page).
- Make a confident, reasonable assumption when you're fairly sure what they mean, and just act — then briefly say what you did so they can correct you. Only ask a clarifying question when there are genuinely multiple distinct things it could be and guessing wrong would be costly. Never reply by asking them for exact names, IDs, or technical terms.
- If they refer to something that doesn't exist in their items, say so plainly and offer to create it, rather than inventing it.

Voice rules (you are spoken aloud through a natural voice):
- Keep your SPOKEN reply SHORT and conversational — usually 1 to 3 sentences, with no markdown, bullet lists, headings, emojis, or read-aloud IDs/JSON.
- This no-formatting rule applies ONLY to the spoken text. When you act, you MUST STILL append the <actions>…</actions> block AFTER your spoken text (see the section below). That block is required to actually do things and is never spoken — do not omit it just because it's JSON.
- Sound human: natural rhythm, contractions, the occasional warm aside. Be specific using the real details below; never invent facts, scores, or events.

Where they are right now:
- The user is on the ${screen.name} screen (${screen.desc}). Use this to resolve vague references ("this page", "this section", "fix this") and to act in context.

What you know about ${firstName || "the user"}:
${facts.length ? facts.map((f) => `- ${f}`).join("\n") : "- (You're still getting to know them — be curious.)"}

Their study data (use only when relevant):
${snap ?? "Not loaded yet."}

The user's current items (refer to these by their exact names when acting on them):
${inventory ?? "Not loaded yet."}

${actionsPrompt}`;
  }, [pathname, firstName]);

  const ask = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || thinking) return;
      if (!hasApiKey) {
        toast.error("Add an AI API key in Settings so Jarvis can talk back.");
        return;
      }
      const next: Msg[] = [...messagesRef.current, { role: "user", text: clean }];
      setMessages(next);
      setThinking(true);
      try {
        // Make sure Jarvis's capabilities + the user's live inventory are loaded
        // before we build the prompt (cached after the first call, so cheap).
        await ensureContext();
        const { generateChatResponse } = await import("@/lib/ai");
        const history: GeminiHistory = next.slice(-16).map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.text }],
        }));
        const reply = await generateChatResponse(aiConfig, history, buildSystemPrompt());

        // Split the spoken reply from any action block Jarvis appended, then
        // carry out those actions against the app's data layer.
        const actionsMod =
          actionsModRef.current ?? (await import("@/lib/jarvis/actions"));
        actionsModRef.current = actionsMod;
        const { say, actions } = actionsMod.parseActions(reply);

        const display = say || (actions.length ? "" : reply);
        if (display) setMessages((prev) => [...prev, { role: "assistant", text: display }]);

        let spoken = say;
        if (actions.length) {
          const inv = inventoryRef.current ?? (await actionsMod.loadInventory());
          inventoryRef.current = inv;
          const results = await actionsMod.executeActions(actions, inv, {
            aiConfig,
            navigate: (route) => router.push(route),
          });
          inventoryPromptRef.current = actionsMod.inventoryToPrompt(inv);
          const summary = results.join(" ");
          if (summary) {
            setMessages((prev) => [...prev, { role: "assistant", text: summary }]);
          }
          spoken = [say, summary].filter(Boolean).join(" ");
          // Let any open page know its data changed so it can refresh in place.
          window.dispatchEvent(new CustomEvent("jarvis:changed"));
        }
        if (!spoken) spoken = reply;

        // In live mode, listen again after Jarvis finishes speaking (or right
        // away when muted) so the conversation flows without tapping anything.
        if (autoSpeak) tts.speak(spoken, { rate: 1.03, onEnd: continueLive });
        else window.setTimeout(continueLive, 300);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Jarvis couldn't respond.");
      } finally {
        setThinking(false);
      }
    },
    [thinking, hasApiKey, ensureContext, aiConfig, buildSystemPrompt, autoSpeak, tts, continueLive, router]
  );

  messagesRef.current = messages;
  askRef.current = ask;

  const setOpen = useCallback(
    (v: boolean) => {
      setOpenState(v);
      if (v) {
        ensureContext();
        setLive(true); // opening starts a hands-free conversation
      } else {
        setLive(false);
        stt.stop();
        tts.cancel();
      }
    },
    [ensureContext, stt, tts]
  );
  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);

  // Pause = stop listening but stay open. Resume = start listening again.
  const pauseListening = useCallback(() => {
    setLive(false);
    stt.stop();
  }, [stt]);
  const resumeListening = useCallback(() => {
    setLive(true);
    startListening();
  }, [startListening]);
  // Stop = end the whole conversation (no more listening) and close.
  const stopConversation = useCallback(() => {
    setLive(false);
    stt.stop();
    tts.cancel();
    setOpenState(false);
  }, [stt, tts]);

  const setHandsFree = useCallback(
    (v: boolean) => {
      setHandsFreeRaw(v);
      if (v) toast.success('Hands-free on — just say "Hey Jarvis".');
    },
    [setHandsFreeRaw]
  );

  // "Hey Jarvis" wake word. Opens Jarvis and either runs a command spoken in the
  // same breath ("hey jarvis, what's my streak") or starts listening for one.
  const handleWake = useCallback(
    (remainder: string) => {
      greetedRef.current = true; // skip the verbose greeting when summoned by voice
      setOpenState(true);
      setLive(true);
      ensureContext();
      const words = remainder.split(/\s+/).filter(Boolean);
      // A command spoken in the same breath ("hey jarvis, what's my streak") runs directly.
      if (words.length >= 2) {
        window.setTimeout(() => askRef.current(remainder), 200);
        return;
      }
      // Otherwise: acknowledge, then start listening for the request.
      tts.cancel();
      if (autoSpeak) {
        tts.speak("Yes?", { onEnd: () => startListenRef.current() });
      } else {
        window.setTimeout(() => startListenRef.current(), 200);
      }
    },
    [ensureContext, tts, autoSpeak]
  );

  const wake = useWakeWord({
    enabled: !!user && handsFree,
    // While the panel is open we're already in a conversation (and using the
    // command mic), so the wake recognizer pauses to avoid conflicting.
    paused: open || stt.listening || tts.speaking || thinking,
    onWake: handleWake,
    onDenied: () => {
      setHandsFreeRaw(false);
      toast.error("Microphone is blocked — can't listen for “Hey Jarvis”.");
    },
  });

  // Greet the first time Jarvis is opened in a session.
  useEffect(() => {
    if (!open || greetedRef.current || messages.length > 0) return;
    greetedRef.current = true;
    const hour = new Date().getHours();
    const part = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
    const hello = firstName
      ? `${part}, ${firstName}. Jarvis here — what can I do for you?`
      : `Jarvis here, at your service. What can I do for you?`;
    setMessages([{ role: "assistant", text: hello }]);
    // After greeting, drop straight into listening (live conversation).
    if (autoSpeak) tts.speak(hello, { onEnd: () => continueLive() });
    else window.setTimeout(() => continueLive(), 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // When Jarvis closes, learn from the conversation in the background.
  const prevOpen = useRef(false);
  useEffect(() => {
    if (prevOpen.current && !open) {
      tts.cancel();
      stt.stop();
      const convo = messagesRef.current;
      const userTurns = convo.filter((m) => m.role === "user").length;
      if (userTurns >= 2 && hasApiKey) {
        import("@/lib/jarvis/memory")
          .then((mod) =>
            mod.updateJarvisMemory(aiConfig, memoryRef.current, convo)
          )
          .then((f) => (memoryRef.current = f))
          .catch(() => {});
      }
    }
    prevOpen.current = open;
  }, [open, aiConfig, hasApiKey, tts, stt]);

  const clearChat = useCallback(() => {
    setMessages([]);
    greetedRef.current = false;
    tts.cancel();
  }, [tts]);

  const state: JarvisState = stt.listening
    ? "listening"
    : thinking
      ? "thinking"
      : tts.speaking
        ? "speaking"
        : "idle";

  const value: JarvisValue = {
    open,
    setOpen,
    toggle,
    messages,
    thinking,
    ask,
    clearChat,
    autoSpeak,
    setAutoSpeak,
    handsFree,
    setHandsFree,
    wakeSupported: wake.supported,
    state,
    speaking: tts.speaking,
    stopSpeaking: tts.cancel,
    listening: stt.listening,
    transcript: stt.transcript,
    live,
    pauseListening,
    resumeListening,
    stopConversation,
    micSupported: stt.supported,
    hasApiKey,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      {user && <JarvisPanel />}
      {user && <JarvisStatusPill />}
    </Ctx.Provider>
  );
}

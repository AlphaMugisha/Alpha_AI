"use client";

import { useEffect, useRef } from "react";

const WAKE_PHRASES = [
  "hey jarvis",
  "hi jarvis",
  "hello jarvis",
  "ok jarvis",
  "okay jarvis",
  "yo jarvis",
  "hey travis", // common mis-recognition of "jarvis"
  "jarvis",
];

/**
 * Always-on "Hey Jarvis" wake-word detection using the Web Speech API.
 *
 * Runs a dedicated continuous recognizer that auto-restarts (the browser stops
 * recognition after silence). It must be PAUSED whenever the command recognizer
 * or TTS is active — only one SpeechRecognition can run at a time, and we don't
 * want Jarvis waking itself from its own voice.
 */
export function useWakeWord({
  enabled,
  paused,
  lang = "en-US",
  onWake,
  onDenied,
}: {
  enabled: boolean;
  paused: boolean;
  lang?: string;
  onWake: (remainder: string) => void;
  onDenied?: () => void;
}) {
  const supportedRef = useRef(
    typeof window !== "undefined" &&
      (!!window.SpeechRecognition || !!window.webkitSpeechRecognition)
  );
  const recRef = useRef<SpeechRecognition | null>(null);
  const runningRef = useRef(false);
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTrigger = useRef(0);
  const shouldRun = useRef(false);
  const onWakeRef = useRef(onWake);
  const onDeniedRef = useRef(onDenied);
  onWakeRef.current = onWake;
  onDeniedRef.current = onDenied;

  shouldRun.current = enabled && !paused;

  useEffect(() => {
    if (!supportedRef.current) return;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return;

    const clearTimer = () => {
      if (restartTimer.current) {
        clearTimeout(restartTimer.current);
        restartTimer.current = null;
      }
    };

    const stop = () => {
      clearTimer();
      const r = recRef.current;
      recRef.current = null;
      runningRef.current = false;
      if (r) {
        r.onend = null;
        r.onresult = null;
        r.onerror = null;
        try {
          r.abort();
        } catch {
          /* ignore */
        }
      }
    };

    const start = () => {
      if (runningRef.current || !shouldRun.current || recRef.current) return;
      const rec = new Ctor();
      rec.lang = lang;
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        runningRef.current = true;
      };
      rec.onerror = (e: SpeechRecognitionErrorEvent) => {
        runningRef.current = false;
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          shouldRun.current = false;
          onDeniedRef.current?.();
        }
      };
      rec.onend = () => {
        runningRef.current = false;
        recRef.current = null;
        if (shouldRun.current) {
          clearTimer();
          restartTimer.current = setTimeout(start, 350);
        }
      };
      rec.onresult = (e: SpeechRecognitionEvent) => {
        let text = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          text += e.results[i][0].transcript;
        }
        const lower = text.toLowerCase();
        const phrase = WAKE_PHRASES.find((p) => lower.includes(p));
        if (!phrase) return;
        const now = Date.now();
        if (now - lastTrigger.current < 3000) return; // cooldown
        lastTrigger.current = now;
        const idx = lower.lastIndexOf(phrase);
        const remainder = text.slice(idx + phrase.length).trim();
        onWakeRef.current(remainder);
        // Restart fresh so the buffer doesn't re-trigger.
        stop();
        if (shouldRun.current) {
          restartTimer.current = setTimeout(start, 500);
        }
      };

      recRef.current = rec;
      try {
        rec.start();
      } catch {
        runningRef.current = false;
        recRef.current = null;
      }
    };

    if (shouldRun.current) start();
    else stop();

    return () => stop();
  }, [enabled, paused, lang]);

  return { supported: supportedRef.current };
}

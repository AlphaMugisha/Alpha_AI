"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/** Pick the most natural-sounding English voice available. */
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const pool = en.length ? en : voices;
  // Prefer richer cloud/natural voices when present.
  const preferred = pool.find((v) =>
    /google|natural|samantha|aria|jenny|libby/i.test(v.name)
  );
  return preferred || pool.find((v) => v.default) || pool[0];
}

export function useSpeechSynthesis() {
  const [supported] = useState(
    () => typeof window !== "undefined" && "speechSynthesis" in window
  );
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!supported) return;
    const load = () => {
      const v = window.speechSynthesis.getVoices();
      setVoices(v);
      setVoice((cur) => cur || pickVoice(v));
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [supported]);

  const speak = useCallback(
    (text: string, opts?: { rate?: number; pitch?: number; onEnd?: () => void }) => {
      if (!supported || !text.trim()) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.rate = opts?.rate ?? 1;
      u.pitch = opts?.pitch ?? 1;
      u.onstart = () => setSpeaking(true);
      u.onend = () => {
        setSpeaking(false);
        opts?.onEnd?.();
      };
      u.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
    },
    [supported, voice]
  );

  const cancel = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  return { supported, voices, voice, setVoice, speaking, speak, cancel };
}

export function useSpeechRecognition(opts?: {
  lang?: string;
  onFinal?: (text: string) => void;
  onEnd?: () => void;
}) {
  const [supported] = useState(
    () =>
      typeof window !== "undefined" &&
      (!!window.SpeechRecognition || !!window.webkitSpeechRecognition)
  );
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recRef = useRef<SpeechRecognition | null>(null);
  const onFinalRef = useRef(opts?.onFinal);
  const onEndRef = useRef(opts?.onEnd);
  onFinalRef.current = opts?.onFinal;
  onEndRef.current = opts?.onEnd;
  const lang = opts?.lang ?? "en-US";

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (!supported) return;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onstart = () => setListening(true);
    rec.onend = () => {
      setListening(false);
      onEndRef.current?.();
    };
    rec.onerror = () => setListening(false);
    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      setTranscript(final || interim);
      if (final.trim()) {
        onFinalRef.current?.(final.trim());
        setTranscript("");
      }
    };
    recRef.current = rec;
    setTranscript("");
    try {
      rec.start();
    } catch {
      // already started / not allowed
    }
  }, [supported, lang]);

  // Clean up any in-flight recognition on unmount.
  useEffect(() => () => recRef.current?.abort(), []);

  return { supported, listening, transcript, start, stop };
}

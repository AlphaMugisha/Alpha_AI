"use client";

import { useCallback, useRef, useState } from "react";
import { useSettings } from "./useSettings";
import { useSpeechSynthesis } from "./useSpeech";
import { synthesizeSpeech, type SpeechHandle } from "@/lib/voice/elevenlabs";
import { DEFAULT_VOICE_ID } from "@/lib/voice/voices";

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  onEnd?: () => void;
}

/**
 * Jarvis's voice. Uses ElevenLabs neural TTS when an API key is configured in
 * Settings; otherwise transparently falls back to the browser's built-in
 * speech synthesis. Same `speak / cancel / speaking` surface as
 * `useSpeechSynthesis`, so it's a drop-in upgrade.
 *
 * If an ElevenLabs call fails (bad key, quota, offline), we don't leave Jarvis
 * mute — we fall back to browser speech for that utterance so the conversation
 * keeps flowing.
 */
export function useVoice() {
  const { settings } = useSettings();
  const browser = useSpeechSynthesis();
  const [neuralSpeaking, setNeuralSpeaking] = useState(false);

  const handleRef = useRef<SpeechHandle | null>(null);
  // Monotonic token: every speak/cancel bumps it so stale async callbacks from
  // a previous utterance are ignored.
  const seqRef = useRef(0);

  const apiKey = (settings.elevenLabsApiKey || "").trim();
  const voiceId = (settings.elevenLabsVoiceId || "").trim() || DEFAULT_VOICE_ID;
  const useNeural = apiKey.length > 0;

  const cancel = useCallback(() => {
    seqRef.current++;
    if (handleRef.current) {
      handleRef.current.stop();
      handleRef.current = null;
    }
    browser.cancel();
    setNeuralSpeaking(false);
  }, [browser]);

  const speak = useCallback(
    (text: string, opts?: SpeakOptions) => {
      if (!text || !text.trim()) return;
      cancel();
      const mySeq = seqRef.current;

      if (!useNeural) {
        browser.speak(text, { rate: opts?.rate, pitch: opts?.pitch, onEnd: opts?.onEnd });
        return;
      }

      const fallbackToBrowser = () => {
        if (mySeq !== seqRef.current) return;
        setNeuralSpeaking(false);
        browser.speak(text, { rate: opts?.rate, pitch: opts?.pitch, onEnd: opts?.onEnd });
      };

      setNeuralSpeaking(true);
      synthesizeSpeech(
        text,
        { apiKey, voiceId },
        {
          onEnd: () => {
            if (mySeq !== seqRef.current) return;
            setNeuralSpeaking(false);
            opts?.onEnd?.();
          },
          onError: () => {
            // Mid-stream failure: stop spinning and let the turn continue.
            if (mySeq !== seqRef.current) return;
            setNeuralSpeaking(false);
            opts?.onEnd?.();
          },
        }
      )
        .then((handle) => {
          if (mySeq !== seqRef.current) {
            handle.stop();
            return;
          }
          handleRef.current = handle;
        })
        .catch(() => {
          // Setup failure (bad key / network / quota): fall back so Jarvis still talks.
          fallbackToBrowser();
        });
    },
    [cancel, useNeural, apiKey, voiceId, browser]
  );

  return {
    supported: useNeural || browser.supported,
    usingNeural: useNeural,
    speaking: neuralSpeaking || browser.speaking,
    speak,
    cancel,
  };
}

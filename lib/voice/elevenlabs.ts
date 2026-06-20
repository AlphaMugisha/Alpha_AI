"use client";

/**
 * ElevenLabs neural text-to-speech for Jarvis.
 *
 * Streams audio for low latency: when the browser supports MediaSource
 * Extensions for MPEG, we append chunks to a SourceBuffer as they arrive so
 * Jarvis starts talking before the whole clip is generated. Otherwise we fall
 * back to fetching the full clip and playing it.
 *
 * No SDK — we call the REST streaming endpoint directly so there's no extra
 * dependency, mirroring how the app already calls AI providers from the client.
 */

const API_BASE = "https://api.elevenlabs.io/v1/text-to-speech";

// turbo_v2_5: very low latency while still natural + expressive. Good balance
// for a back-and-forth voice assistant.
export const DEFAULT_MODEL = "eleven_turbo_v2_5";

export interface ElevenLabsVoiceConfig {
  apiKey: string;
  voiceId: string;
  modelId?: string;
}

export interface SpeechHandlers {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}

export interface SpeechHandle {
  stop: () => void;
}

function mpegStreamingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaSource !== "undefined" &&
    typeof MediaSource.isTypeSupported === "function" &&
    MediaSource.isTypeSupported("audio/mpeg")
  );
}

/**
 * Synthesize and start playing `text`. Resolves once playback has started (or
 * the audio has been fetched). Throws on setup failures (bad key, network,
 * quota) so the caller can fall back to browser speech. Runtime/streaming
 * errors are reported via `handlers.onError`.
 */
export async function synthesizeSpeech(
  text: string,
  cfg: ElevenLabsVoiceConfig,
  handlers: SpeechHandlers = {}
): Promise<SpeechHandle> {
  const audio = new Audio();
  let stopped = false;
  let started = false;

  const stop = () => {
    stopped = true;
    try {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    } catch {
      /* ignore */
    }
  };

  audio.onended = () => {
    if (stopped) return;
    stopped = true;
    handlers.onEnd?.();
  };
  audio.onerror = () => {
    if (stopped || !started) return; // ignore errors from clearing src on stop
    stopped = true;
    handlers.onError?.(new Error("Audio playback failed."));
  };

  const url =
    `${API_BASE}/${cfg.voiceId}/stream` +
    `?optimize_streaming_latency=3&output_format=mp3_44100_128`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": cfg.apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: cfg.modelId ?? DEFAULT_MODEL,
      // Lower stability + some style = warmer, more expressive, human pacing.
      voice_settings: {
        stability: 0.4,
        similarity_boost: 0.8,
        style: 0.35,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok || !res.body) {
    let detail = `ElevenLabs request failed (${res.status}).`;
    try {
      const j = await res.json();
      detail = j?.detail?.message || (typeof j?.detail === "string" ? j.detail : detail);
    } catch {
      /* keep default */
    }
    throw new Error(detail);
  }

  if (mpegStreamingSupported()) {
    const mediaSource = new MediaSource();
    audio.src = URL.createObjectURL(mediaSource);
    await new Promise<void>((resolve) =>
      mediaSource.addEventListener("sourceopen", () => resolve(), { once: true })
    );
    if (stopped) return { stop };

    const sb = mediaSource.addSourceBuffer("audio/mpeg");
    const reader = res.body.getReader();

    const appendChunk = (chunk: Uint8Array) =>
      new Promise<void>((resolve, reject) => {
        sb.addEventListener("updateend", () => resolve(), { once: true });
        sb.addEventListener("error", () => reject(new Error("buffer error")), { once: true });
        try {
          sb.appendBuffer(chunk as unknown as BufferSource);
        } catch (e) {
          reject(e);
        }
      });

    // Pump chunks into the buffer in the background while playback proceeds.
    (async () => {
      try {
        while (!stopped) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value && value.byteLength) await appendChunk(value);
        }
        if (!stopped && mediaSource.readyState === "open") mediaSource.endOfStream();
      } catch (err) {
        if (!stopped) handlers.onError?.(err);
      }
    })();

    started = true;
    handlers.onStart?.();
    try {
      await audio.play();
    } catch (e) {
      throw e instanceof Error ? e : new Error("Could not start audio.");
    }
    return { stop };
  }

  // Fallback: no MSE — fetch the whole clip, then play.
  const blob = await res.blob();
  if (stopped) return { stop };
  audio.src = URL.createObjectURL(blob);
  started = true;
  handlers.onStart?.();
  try {
    await audio.play();
  } catch (e) {
    throw e instanceof Error ? e : new Error("Could not start audio.");
  }
  return { stop };
}

/**
 * Curated ElevenLabs premade voices for Jarvis. These are stable public voice
 * IDs from ElevenLabs' default voice library. We default to a calm, confident,
 * professional voice that fits a Jarvis-style companion; the user can switch in
 * Settings.
 */

export interface VoiceOption {
  id: string;
  name: string;
  description: string;
}

export const VOICES: VoiceOption[] = [
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", description: "Calm, deep, professional — the default Jarvis voice" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", description: "British, composed, authoritative — classic Jarvis" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", description: "Warm, friendly British narrator" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", description: "Confident, clear British female" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", description: "Soft, friendly, reassuring female" },
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", description: "Calm, natural female narrator" },
];

export const DEFAULT_VOICE_ID = VOICES[0].id;

export function voiceName(id: string): string {
  return VOICES.find((v) => v.id === id)?.name ?? "Custom voice";
}

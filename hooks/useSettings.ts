"use client";

import { useEffect } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { useAuth } from "./useAuth";
import { UserSettings, AIConfig } from "@/types";

const DEFAULT_SETTINGS: UserSettings = {
  geminiApiKey: "",
  openaiApiKey: "",
  anthropicApiKey: "",
  groqApiKey: "",
  aiProvider: "gemini",
  theme: "system",
  defaultDifficulty: "intermediate",
  notificationsEnabled: true,
  dailyGoalMinutes: 60,
  elevenLabsApiKey: "",
  elevenLabsVoiceId: "",
};

export function useSettings() {
  const [settings, setSettings] = useLocalStorage<UserSettings>(
    "studypilot_settings",
    DEFAULT_SETTINGS
  );

  const { profile } = useAuth();

  // When a Supabase profile loads, hydrate any empty local keys from it
  useEffect(() => {
    if (!profile) return;
    setSettings((prev) => ({
      ...prev,
      geminiApiKey: prev.geminiApiKey || profile.gemini_api_key || "",
      openaiApiKey: prev.openaiApiKey || profile.openai_api_key || "",
      anthropicApiKey: prev.anthropicApiKey || profile.anthropic_api_key || "",
      groqApiKey: prev.groqApiKey || profile.groq_api_key || "",
      aiProvider: (profile.ai_provider as UserSettings["aiProvider"]) || prev.aiProvider,
      dailyGoalMinutes: profile.daily_goal_minutes ?? prev.dailyGoalMinutes,
      defaultDifficulty:
        (profile.default_difficulty as UserSettings["defaultDifficulty"]) ||
        prev.defaultDifficulty,
      notificationsEnabled: profile.notifications_enabled ?? prev.notificationsEnabled,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const updateSettings = (updates: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  };

  const provider = settings.aiProvider ?? "gemini";
  const activeKey =
    provider === "openai"
      ? settings.openaiApiKey
      : provider === "anthropic"
        ? settings.anthropicApiKey
        : provider === "groq"
          ? settings.groqApiKey
          : settings.geminiApiKey;

  const aiConfig: AIConfig = {
    provider,
    apiKey: activeKey || "",
  };

  const hasApiKey = aiConfig.apiKey.trim().length > 0;
  const hasGeminiKey = (settings.geminiApiKey || "").trim().length > 0;
  const hasOpenAIKey = (settings.openaiApiKey || "").trim().length > 0;
  const hasAnthropicKey = (settings.anthropicApiKey || "").trim().length > 0;
  const hasGroqKey = (settings.groqApiKey || "").trim().length > 0;

  return {
    settings,
    updateSettings,
    aiConfig,
    hasApiKey,
    hasGeminiKey,
    hasOpenAIKey,
    hasAnthropicKey,
    hasGroqKey,
  };
}

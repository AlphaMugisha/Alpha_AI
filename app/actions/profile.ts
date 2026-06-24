"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

interface ProfileUpdate {
  full_name?: string;
  avatar_url?: string;
  username?: string;
  phone?: string;
  gemini_api_key?: string;
  openai_api_key?: string;
  anthropic_api_key?: string;
  groq_api_key?: string;
  openrouter_api_key?: string;
  ai_provider?: string;
  daily_goal_minutes?: number;
  default_difficulty?: string;
  notifications_enabled?: boolean;
}

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,30}$/;

export async function updateProfile(data: ProfileUpdate) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated." };

  if (
    data.username !== undefined &&
    data.username !== "" &&
    !USERNAME_RE.test(data.username)
  ) {
    return {
      error:
        "Username must be 3–30 characters: letters, numbers, and . _ - only.",
    };
  }

  // Empty username/phone → null so the partial unique indexes don't collide.
  const payload: Record<string, unknown> = { ...data };
  if (data.username !== undefined) payload.username = data.username || null;
  if (data.phone !== undefined) payload.phone = data.phone || null;

  const { error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") {
      return { error: "That username or phone is already taken." };
    }
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

export async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return data;
}

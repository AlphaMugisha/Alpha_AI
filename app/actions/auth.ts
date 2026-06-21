"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,30}$/;

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const identifier = ((formData.get("identifier") as string) || "").trim();
  const password = formData.get("password") as string;

  if (!identifier || !password) {
    return { error: "Enter your login and password." };
  }

  // Resolve username / phone to the account email. An email is used as-is.
  let email = identifier;
  if (!identifier.includes("@")) {
    const { data, error } = await supabase.rpc("get_email_for_login", {
      identifier,
    });
    if (error || !data) {
      return { error: "No account found with that username, email, or phone." };
    }
    email = data as string;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signInWithProvider(provider: "google" | "facebook") {
  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${siteUrl}/auth/callback?next=/dashboard`,
    },
  });

  if (error) return { error: error.message };
  if (data?.url) redirect(data.url);
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();
  const email = ((formData.get("email") as string) || "").trim();
  const password = formData.get("password") as string;
  const fullName = ((formData.get("fullName") as string) || "").trim();
  const username = ((formData.get("username") as string) || "").trim();
  const phone = ((formData.get("phone") as string) || "").trim();

  if (!USERNAME_RE.test(username)) {
    return {
      error:
        "Username must be 3–30 characters: letters, numbers, and . _ - only.",
    };
  }

  const { data: available } = await supabase.rpc("username_available", {
    uname: username,
  });
  if (available === false) {
    return { error: "That username is already taken — try another." };
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, username, phone: phone || null },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });

  if (error) return { error: error.message };
  return { success: "Check your email to verify your account before logging in." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function forgotPassword(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback?next=/reset-password`,
  });

  if (error) return { error: error.message };
  return { success: "Password reset link sent — check your email." };
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient();
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

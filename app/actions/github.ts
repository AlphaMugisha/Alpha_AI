"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * GitHub integration. The token lives in the user's profile and is only ever
 * read here on the server — it never reaches the browser.
 */

const GH = "https://api.github.com";

function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("github_token, github_username, focus_repo, daily_commit_goal")
    .eq("id", user.id)
    .single();
  return { supabase, user, profile };
}

export interface GithubStatus {
  connected: boolean;
  username: string | null;
  focusRepo: string | null;
  dailyGoal: number;
}

export async function getGithubStatus(): Promise<GithubStatus> {
  const { profile } = await getProfile();
  return {
    connected: Boolean(profile?.github_token),
    username: profile?.github_username ?? null,
    focusRepo: profile?.focus_repo ?? null,
    dailyGoal: profile?.daily_commit_goal ?? 20,
  };
}

export async function connectGithub(token: string) {
  const trimmed = token.trim();
  if (!trimmed) return { error: "Please paste a token." };

  // Validate the token against GitHub and capture the username.
  const res = await fetch(`${GH}/user`, {
    headers: ghHeaders(trimmed),
    cache: "no-store",
  });
  if (!res.ok) {
    return {
      error:
        res.status === 401
          ? "That token was rejected by GitHub. Make sure it's valid and has the 'repo' scope."
          : `GitHub error (${res.status}). Please try again.`,
    };
  }
  const me = await res.json();

  const { supabase, user } = await getProfile();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("profiles")
    .update({ github_token: trimmed, github_username: me.login })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: true, username: me.login as string };
}

export async function disconnectGithub() {
  const { supabase, user } = await getProfile();
  if (!user) return { error: "Not signed in." };
  const { error } = await supabase
    .from("profiles")
    .update({ github_token: "", github_username: null, focus_repo: null })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function setFocusRepo(fullName: string) {
  const { supabase, user } = await getProfile();
  if (!user) return { error: "Not signed in." };
  const { error } = await supabase
    .from("profiles")
    .update({ focus_repo: fullName })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/repos");
  return { success: true };
}

export async function setDailyGoal(goal: number) {
  const { supabase, user } = await getProfile();
  if (!user) return { error: "Not signed in." };
  const safe = Math.max(1, Math.min(200, Math.round(goal) || 20));
  const { error } = await supabase
    .from("profiles")
    .update({ daily_commit_goal: safe })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  return { success: true, goal: safe };
}

export interface RepoInfo {
  name: string;
  fullName: string;
  description: string | null;
  pushedAt: string | null;
  htmlUrl: string;
  homepage: string | null;
  private: boolean;
  language: string | null;
  category: "project" | "submission" | "revision" | null;
  done: boolean;
}

type GhRepo = {
  name: string;
  full_name: string;
  description: string | null;
  pushed_at: string | null;
  html_url: string;
  homepage: string | null;
  private: boolean;
  language: string | null;
};

async function fetchGhRepos(token: string): Promise<GhRepo[] | null> {
  const res = await fetch(
    `${GH}/user/repos?per_page=100&sort=pushed&affiliation=owner`,
    { headers: ghHeaders(token), cache: "no-store" }
  );
  if (!res.ok) return null;
  return (await res.json()) as GhRepo[];
}

export async function listRepos(): Promise<{
  repos?: RepoInfo[];
  error?: string;
}> {
  const { supabase, user, profile } = await getProfile();
  if (!user) return { error: "Not signed in." };
  if (!profile?.github_token) return { error: "GitHub not connected." };

  const data = await fetchGhRepos(profile.github_token);
  if (!data) return { error: "Could not fetch repos from GitHub." };

  const { data: classes } = await supabase
    .from("repo_classifications")
    .select("repo_full_name, category, done");
  const map = new Map(
    (classes ?? []).map((c) => [
      c.repo_full_name,
      { category: c.category as RepoInfo["category"], done: c.done as boolean },
    ])
  );

  const repos: RepoInfo[] = data.map((r) => {
    const state = map.get(r.full_name);
    return {
      name: r.name,
      fullName: r.full_name,
      description: r.description,
      pushedAt: r.pushed_at,
      htmlUrl: r.html_url,
      homepage: r.homepage,
      private: r.private,
      language: r.language,
      category: state?.category ?? null,
      done: state?.done ?? false,
    };
  });
  return { repos };
}

export async function setRepoDone(fullName: string, done: boolean) {
  const { supabase, user } = await getProfile();
  if (!user) return { error: "Not signed in." };
  const { error } = await supabase.from("repo_classifications").upsert(
    { repo_full_name: fullName, done, updated_at: new Date().toISOString() },
    { onConflict: "user_id,repo_full_name" }
  );
  if (error) return { error: error.message };
  revalidatePath("/repos");
  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * Pull every repo classified as "project" into the Project Manager.
 * Already-imported repos are skipped, so it's safe to run repeatedly.
 */
export async function importProjectRepos() {
  const { supabase, user, profile } = await getProfile();
  if (!user) return { error: "Not signed in." };
  if (!profile?.github_token) return { error: "GitHub not connected." };

  const { data: classes } = await supabase
    .from("repo_classifications")
    .select("repo_full_name")
    .eq("category", "project");
  const projectRepoNames = new Set((classes ?? []).map((c) => c.repo_full_name));
  if (projectRepoNames.size === 0) {
    return { imported: 0, message: "No repos are classified as 'Project' yet." };
  }

  const ghRepos = await fetchGhRepos(profile.github_token);
  if (!ghRepos) return { error: "Could not fetch repos from GitHub." };

  // Skip repos already imported.
  const { data: existing } = await supabase
    .from("coding_projects")
    .select("repo_full_name")
    .not("repo_full_name", "is", null);
  const alreadyImported = new Set((existing ?? []).map((p) => p.repo_full_name));

  const rows = ghRepos
    .filter(
      (r) => projectRepoNames.has(r.full_name) && !alreadyImported.has(r.full_name)
    )
    .map((r) => ({
      name: r.name,
      description: r.description ?? "",
      status: "in-progress",
      tech_stack: r.language ? [r.language] : [],
      repo_url: r.html_url,
      live_url: r.homepage || null,
      priority: "medium",
      progress: 0,
      repo_full_name: r.full_name,
    }));

  if (rows.length === 0) {
    return { imported: 0, message: "Your project repos are already imported." };
  }

  const { error } = await supabase.from("coding_projects").insert(rows);
  if (error) return { error: error.message };

  revalidatePath("/projects");
  return { imported: rows.length };
}

export async function classifyRepo(
  fullName: string,
  category: "project" | "submission" | "revision" | null
) {
  const { supabase, user } = await getProfile();
  if (!user) return { error: "Not signed in." };

  if (category === null) {
    const { error } = await supabase
      .from("repo_classifications")
      .delete()
      .eq("repo_full_name", fullName);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("repo_classifications")
      .upsert(
        { repo_full_name: fullName, category, updated_at: new Date().toISOString() },
        { onConflict: "user_id,repo_full_name" }
      );
    if (error) return { error: error.message };
  }
  revalidatePath("/repos");
  return { success: true };
}

export interface CommitGoal {
  connected: boolean;
  focusRepo: string | null;
  dailyGoal: number;
  count: number;
  error?: string;
}

/**
 * How many commits the user has authored to their focus repo since the start
 * of *their* local day. The client passes start-of-day so timezones line up.
 */
export async function getCommitGoal(startOfDayISO: string): Promise<CommitGoal> {
  const { profile } = await getProfile();
  const dailyGoal = profile?.daily_commit_goal ?? 20;
  const focusRepo = profile?.focus_repo ?? null;

  if (!profile?.github_token) {
    return { connected: false, focusRepo, dailyGoal, count: 0 };
  }
  if (!focusRepo || !profile.github_username) {
    return { connected: true, focusRepo, dailyGoal, count: 0 };
  }

  const url = `${GH}/repos/${focusRepo}/commits?author=${encodeURIComponent(
    profile.github_username
  )}&since=${encodeURIComponent(startOfDayISO)}&per_page=100`;
  const res = await fetch(url, {
    headers: ghHeaders(profile.github_token),
    cache: "no-store",
  });
  if (!res.ok) {
    return {
      connected: true,
      focusRepo,
      dailyGoal,
      count: 0,
      error: `GitHub error (${res.status})`,
    };
  }
  const commits = await res.json();
  const count = Array.isArray(commits) ? commits.length : 0;
  return { connected: true, focusRepo, dailyGoal, count };
}

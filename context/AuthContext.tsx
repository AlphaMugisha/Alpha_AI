"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { User, Session, AuthChangeEvent, type Session as SupabaseSession } from "@supabase/supabase-js";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  username: string | null;
  phone: string | null;
  gemini_api_key: string;
  openai_api_key: string;
  anthropic_api_key: string;
  groq_api_key: string;
  ai_provider: string;
  daily_goal_minutes: number;
  default_difficulty: string;
  notifications_enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  loading: false,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const supabase = isSupabaseConfigured ? createClient() : null;

  const fetchProfile = useCallback(
    async (userId: string) => {
      if (!supabase) return;
      try {
        const { data, error } = await supabase
          .from("profiles")
          // Explicit columns — never ship github_token to the browser.
          .select(
            "id, full_name, avatar_url, username, phone, gemini_api_key, openai_api_key, anthropic_api_key, groq_api_key, ai_provider, daily_goal_minutes, default_difficulty, notifications_enabled, created_at, updated_at"
          )
          .eq("id", userId)
          .single();
        if (!error && data) setProfile(data as Profile);
      } catch {
        // Transient network failure reaching Supabase — keep going without the
        // profile rather than throwing an uncaught "Failed to fetch".
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  useEffect(() => {
    if (!supabase) return;

    const init = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) await fetchProfile(session.user.id);
      } catch {
        // Couldn't reach Supabase (offline / flaky network). Treat as
        // signed-out for now; onAuthStateChange will recover the session
        // automatically once connectivity returns.
      } finally {
        setLoading(false);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event: AuthChangeEvent, session: SupabaseSession | null) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, profile, session, loading, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}

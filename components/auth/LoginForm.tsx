"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn, signInWithProvider } from "@/app/actions/auth";
import { Eye, EyeOff, User, Loader2 } from "lucide-react";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5h-1.9V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 7.9-21l5.7-5.7A20 20 0 1 0 24 44c11 0 20-8 20-20 0-1.3-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C39.9 36.3 44 31 44 24c0-1.3-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.24 2.69.24v2.97h-1.52c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"
      />
    </svg>
  );
}

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [oauthPending, setOauthPending] = useState<"google" | "facebook" | null>(null);
  const searchParams = useSearchParams();
  const callbackError = searchParams.get("error");

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await signIn(formData);
      if (result?.error) setError(result.error);
    });
  }

  async function handleOAuth(provider: "google" | "facebook") {
    setError(null);
    setOauthPending(provider);
    const result = await signInWithProvider(provider);
    // On success the action redirects; we only land here on failure.
    if (result?.error) setError(result.error);
    setOauthPending(null);
  }

  return (
    <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-slate-900/50 p-8 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-12 duration-700 ease-out">
      {/* subtle inner highlight */}
      <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-b from-white/10 to-transparent" />

      <div className="relative">
        <h1 className="mb-7 text-center text-3xl font-bold tracking-tight text-white drop-shadow">
          Login
        </h1>

        {(error || callbackError) && (
          <div className="mb-4 rounded-xl border border-red-300/30 bg-red-500/20 px-4 py-3 text-sm text-red-50 backdrop-blur">
            {error ?? "Authentication failed. Please try again."}
          </div>
        )}

        <form action={handleSubmit} className="space-y-4">
          {/* Username */}
          <div className="relative">
            <input
              id="identifier"
              name="identifier"
              type="text"
              placeholder="Username"
              required
              autoComplete="username"
              aria-label="Username, email, or phone"
              className="h-12 w-full rounded-full border border-white/30 bg-white/10 px-5 pr-12 text-sm text-white placeholder:text-white/70 outline-none transition focus:border-white/60 focus:bg-white/20"
            />
            <User className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/80" />
          </div>

          {/* Password */}
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              required
              autoComplete="current-password"
              className="h-12 w-full rounded-full border border-white/30 bg-white/10 px-5 pr-12 text-sm text-white placeholder:text-white/70 outline-none transition focus:border-white/60 focus:bg-white/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 transition hover:text-white"
            >
              {showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            </button>
          </div>

          {/* Remember me + Forgot */}
          <div className="flex items-center justify-between px-1 text-sm">
            <label className="flex cursor-pointer select-none items-center gap-2 text-white/90">
              <input
                type="checkbox"
                name="remember"
                className="h-4 w-4 rounded border-white/40 bg-white/10 accent-white"
              />
              Remember me
            </label>
            <Link
              href="/forgot-password"
              className="font-medium text-white/90 transition hover:text-white"
            >
              Forgot Password?
            </Link>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending}
            className="flex h-12 w-full items-center justify-center rounded-full bg-white text-base font-semibold text-slate-800 shadow-lg transition hover:bg-white/90 disabled:opacity-70"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              "Login"
            )}
          </button>
        </form>

        {/* Social */}
        <div className="mt-6 flex items-center justify-center gap-5 text-sm font-medium text-white">
          <button
            type="button"
            onClick={() => handleOAuth("google")}
            disabled={oauthPending !== null}
            className="flex items-center gap-2 transition hover:opacity-80 disabled:opacity-50"
          >
            {oauthPending === "google" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <GoogleIcon className="h-5 w-5" />
            )}
            Google
          </button>

          <span className="text-white/50">--</span>

          <button
            type="button"
            onClick={() => handleOAuth("facebook")}
            disabled={oauthPending !== null}
            className="flex items-center gap-2 transition hover:opacity-80 disabled:opacity-50"
          >
            {oauthPending === "facebook" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <FacebookIcon className="h-5 w-5" />
            )}
            Facebook
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-white/80">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-semibold text-white hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

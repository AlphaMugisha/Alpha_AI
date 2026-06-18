/**
 * Turns cryptic provider SDK errors into clear, actionable messages so the
 * user sees *why* a request failed (quota, bad key, blocked, etc.) instead of
 * a raw stack/JSON blob.
 */
export function friendlyAIError(
  err: unknown,
  provider: "openai" | "gemini" | "anthropic" | "groq"
): Error {
  const name =
    provider === "openai"
      ? "OpenAI"
      : provider === "anthropic"
        ? "Claude"
        : provider === "groq"
          ? "Groq"
          : "Gemini";
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  // SDKs expose the HTTP status in a few different shapes.
  const e = err as { status?: number; code?: number | string; response?: { status?: number } };
  const status = Number(e?.status ?? e?.response?.status ?? e?.code) || undefined;

  const has = (...needles: string[]) => needles.some((n) => lower.includes(n));

  // Quota / rate limit
  if (status === 429 || has("quota", "rate limit", "resource_exhausted", "resource has been exhausted", "exhausted", "too many requests", "exceeded your current quota")) {
    return new Error(
      provider === "openai"
        ? "OpenAI quota exceeded — your account is out of credit or over its rate limit. Check your OpenAI plan & billing, or switch to Gemini in Settings."
        : "Gemini rate limit/quota reached. Free keys allow only a few requests per minute and a daily cap — wait a minute and retry, or enable billing on your Google AI key."
    );
  }

  // Auth / key problems
  if (status === 401 || status === 403 || has("api key", "api_key_invalid", "unauthorized", "permission denied", "invalid authentication", "invalid key")) {
    return new Error(
      `Your ${name} API key looks invalid or doesn't have access. Re-check it in Settings.`
    );
  }

  // Model not found / no access
  if (status === 404 || has("not found", "does not exist", "is not supported")) {
    return new Error(
      `${name} couldn't find the requested model for your key. It may not be enabled on your account. (${raw})`
    );
  }

  // Safety / blocked output (mostly Gemini)
  if (has("safety", "blocked", "was blocked", "candidate", "recitation")) {
    return new Error(
      `${name} blocked this response (safety filters). Try rephrasing or using different source material.`
    );
  }

  // Temporary outage
  if (status === 500 || status === 503 || has("overloaded", "unavailable", "try again later")) {
    return new Error(`${name} is temporarily overloaded. Please try again in a moment.`);
  }

  // Network
  if (has("fetch failed", "network", "enotfound", "etimedout", "failed to fetch")) {
    return new Error(`Couldn't reach ${name}. Check your internet connection and try again.`);
  }

  return new Error(`${name} error: ${raw}`);
}

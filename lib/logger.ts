/**
 * Structured server logging.
 *
 * WHAT IT IS: a tiny wrapper that prints one JSON object per log line.
 * WHY WE NEED IT: hosting platforms (Vercel, Railway, Fly) index JSON logs, so
 * "show me every audit that timed out" becomes a query instead of a grep. It
 * also gives us one place to guarantee that secrets never reach the logs.
 *
 * We log what happened, not what was in it: audit id, host, status, duration.
 * Never cookies, headers, tokens or page content.
 */

import { isProduction } from "@/lib/config/env";

type LogLevel = "debug" | "info" | "warn" | "error";

/** Keys that must never be written to a log line, at any nesting depth. */
const REDACTED_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "password",
  "token",
  "apikey",
  "api_key",
  "secret",
  "x-api-key",
  "proxy-authorization",
]);

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (value === null || typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => redact(item, depth + 1));
  }

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    output[key] = REDACTED_KEYS.has(key.toLowerCase()) ? "[redacted]" : redact(entry, depth + 1);
  }
  return output;
}

function write(level: LogLevel, message: string, context?: Record<string, unknown>) {
  if (level === "debug" && isProduction) return;

  const line = {
    level,
    time: new Date().toISOString(),
    message,
    ...(context ? (redact(context) as Record<string, unknown>) : {}),
  };

  const serialised = JSON.stringify(line);

  if (level === "error") console.error(serialised);
  else if (level === "warn") console.warn(serialised);
  else console.log(serialised);
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => write("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => write("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => write("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => write("error", message, context),
};

/**
 * Reduce an unknown thrown value to something safe to log.
 * Stack traces stay server-side; they are never returned to a user.
 */
export function describeError(error: unknown): { name: string; message: string; code?: string } {
  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    return {
      name: error.name,
      message: error.message,
      ...(code ? { code } : {}),
    };
  }
  return { name: "UnknownError", message: String(error) };
}

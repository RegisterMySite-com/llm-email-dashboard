/**
 * Fixed-window rate limiting middleware backed by D1.
 * Used as a gate before auth, chat, send, and admin API handlers.
 */

import { clientIp } from "./auth";

export interface RateLimitRule {
  /** Bucket name, e.g. "login" or "chat" */
  name: string;
  /** Max requests allowed in the window */
  limit: number;
  /** Window length in milliseconds */
  windowMs: number;
  /** Override the identity key (defaults to client IP) */
  identity?: string;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSec: number;
}

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    window_start INTEGER NOT NULL,
    count INTEGER NOT NULL
  )
`;

let tableReady = false;

export async function ensureRateLimitTable(db: D1Database): Promise<void> {
  if (tableReady) return;
  await db.prepare(SCHEMA_SQL).run();
  tableReady = true;
}

export function rateLimitHeaders(info: RateLimitInfo): Record<string, string> {
  return {
    "x-ratelimit-limit": String(info.limit),
    "x-ratelimit-remaining": String(Math.max(0, info.remaining)),
    "x-ratelimit-reset": String(Math.ceil(info.resetAt / 1000)),
    ...(info.remaining < 0
      ? { "retry-after": String(info.retryAfterSec) }
      : {}),
  };
}

export function rateLimitedResponse(
  info: RateLimitInfo,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: `Too many requests. Try again in ${info.retryAfterSec} second${info.retryAfterSec === 1 ? "" : "s"}.`,
      code: "RATE_LIMITED",
      retryAfter: info.retryAfterSec,
    }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
        "access-control-allow-headers": "Content-Type",
        ...rateLimitHeaders(info),
        ...extraHeaders,
      },
    },
  );
}

export async function consumeRateLimit(
  db: D1Database,
  request: Request,
  rule: RateLimitRule,
): Promise<RateLimitInfo> {
  await ensureRateLimitTable(db);

  const id = (rule.identity || clientIp(request) || "unknown").slice(0, 180);
  const key = `${rule.name}:${id}`;
  const now = Date.now();
  const windowStartFloor = now - (now % rule.windowMs);

  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, window_start, count)
       VALUES (?, ?, 1)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE
           WHEN rate_limits.window_start < ? THEN 1
           ELSE rate_limits.count + 1
         END,
         window_start = CASE
           WHEN rate_limits.window_start < ? THEN ?
           ELSE rate_limits.window_start
         END
       RETURNING count, window_start`,
    )
    .bind(
        key,
        windowStartFloor,
        windowStartFloor,
        windowStartFloor,
        windowStartFloor,
      )
    .first<{ count: number; window_start: number }>();

  const count = Number(row?.count || 1);
  const windowStart = Number(row?.window_start || windowStartFloor);
  const resetAt = windowStart + rule.windowMs;
  const remaining = rule.limit - count;

  return {
    limit: rule.limit,
    remaining,
    resetAt,
    retryAfterSec: Math.max(1, Math.ceil((resetAt - now) / 1000)),
  };
}

export async function rateLimit(
  db: D1Database | undefined,
  request: Request,
  rule: RateLimitRule,
): Promise<Response | null> {
  if (!db) return null;
  try {
    const info = await consumeRateLimit(db, request, rule);
    if (info.remaining < 0) return rateLimitedResponse(info);
    return null;
  } catch (err) {
    console.warn("Rate limit check failed (failing open):", err);
    return null;
  }
}

export const LIMITS = {
  register: { name: "register", limit: 5, windowMs: 15 * 60 * 1000 },
  login: { name: "login", limit: 10, windowMs: 15 * 60 * 1000 },
  chat: { name: "chat", limit: 20, windowMs: 5 * 60 * 1000 },
  send: { name: "send", limit: 8, windowMs: 10 * 60 * 1000 },
  admin: { name: "admin", limit: 120, windowMs: 60 * 1000 },
  api: { name: "api", limit: 180, windowMs: 60 * 1000 },
} as const satisfies Record<string, Omit<RateLimitRule, "identity">>;

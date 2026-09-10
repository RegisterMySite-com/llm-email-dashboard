/**
 * Type definitions for the Email Template Generator + Composer.
 */

/** Cloudflare Workers environment bindings & vars */
export interface Env {
  /** Workers AI binding */
  AI: Ai;

  /** Static assets binding */
  ASSETS: { fetch: (request: Request) => Promise<Response> };

  /** Cloudflare Email Service send binding */
  EMAIL: SendEmail;

  /** D1 database for accounts, sessions, and admin audit */
  DB: D1Database;

  /** Root domain for sender aliases (e.g. "yourdomain.com") */
  ROOT_DOMAIN: string;

  /** Default from address shown in the composer UI */
  DEFAULT_FROM: string;

  /** Comma-separated list of allowed sender addresses for the UI dropdown */
  ALLOWED_SENDERS: string;

  /**
   * Comma-separated emails that are always treated as admins
   * (promoted on register / login).
   */
  ADMIN_EMAILS?: string;
}

export type UserRole = "user" | "admin";
export type UserStatus = "active" | "suspended" | "banned" | "deleted";

export interface UserRecord {
  id: string;
  email: string;
  display_name: string | null;
  password_hash: string;
  role: UserRole;
  status: UserStatus;
  accepted_terms_at: number | null;
  created_at: number;
  updated_at: number;
  last_login_at: number | null;
  last_login_ip: string | null;
  notes: string | null;
}

/** Safe user object returned to the client (never includes password_hash). */
export interface PublicUser {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  status: UserStatus;
  acceptedTermsAt: number | null;
  createdAt: number;
  lastLoginAt: number | null;
  notes?: string | null;
}

export interface SessionRecord {
  id: string;
  user_id: string;
  expires_at: number;
  created_at: number;
  user_agent: string | null;
}

export interface AuditRecord {
  id: string;
  actor_id: string | null;
  target_id: string | null;
  action: string;
  detail: string | null;
  created_at: number;
}

/** Chat message shape used by the LLM API */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Request body for /api/chat */
export interface ChatRequest {
  messages: ChatMessage[];
}

/** Request body for /api/send */
export interface SendEmailRequest {
  from: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}

/** Successful send response */
export interface SendEmailResponse {
  success: true;
  messageId: string;
}

/** Error response */
export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
}

/**
 * Minimal typing for the Email Service binding.
 * Full docs: https://developers.cloudflare.com/email-service/api/send-emails/workers-api/
 */
export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailMessageBuilder {
  to: string | EmailAddress | (string | EmailAddress)[];
  from: string | EmailAddress;
  subject: string;
  html?: string;
  text?: string;
  cc?: string | EmailAddress | (string | EmailAddress)[];
  bcc?: string | EmailAddress | (string | EmailAddress)[];
  replyTo?: string | EmailAddress;
  headers?: Record<string, string>;
}

export interface EmailSendResult {
  messageId: string;
}

export interface SendEmail {
  send(message: EmailMessageBuilder): Promise<EmailSendResult>;
}

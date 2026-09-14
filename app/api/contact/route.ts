/**
 * POST /api/contact — deliver a contact message.
 *
 * HONESTY NOTE: there is no email service wired into this project, because
 * adding one would mean inventing credentials that do not exist. Instead the
 * route forwards the message to whatever webhook you configure in
 * CONTACT_WEBHOOK_URL — Slack, Discord, Zapier, Formspree, your own endpoint.
 *
 * If that variable is not set, the route says so plainly and returns 503. It
 * does not accept the message and quietly drop it, which is the failure mode
 * of every contact form that looks like it works and does not.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { clientKeyFromRequest, consume } from "@/lib/rate-limit";
import { describeError, logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(120),
  email: z.string().trim().email("Please enter a valid email address.").max(200),
  message: z
    .string()
    .trim()
    .min(10, "Please write a little more so we can help.")
    .max(5000, "Please keep the message under 5000 characters."),
  /** Honeypot. A real person never fills this in; bots usually do. */
  website: z.string().max(0).optional(),
});

export async function POST(request: Request) {
  // Contact submissions get their own, stricter allowance.
  const rateLimit = consume(`contact:${clientKeyFromRequest(request)}`, {
    limit: 3,
    windowMs: 60 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: "Too many messages from this connection. Please try again later.",
        },
      },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "The request body must be valid JSON." } },
      { status: 400 },
    );
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: parsed.error.issues[0]?.message ?? "Please check the form and try again.",
          field: parsed.error.issues[0]?.path[0] ?? null,
        },
      },
      { status: 400 },
    );
  }

  // Silently accept-and-discard for the honeypot: telling a bot it was caught
  // only teaches it to stop filling the field in.
  if (parsed.data.website) {
    logger.info("contact.honeypot_triggered");
    return NextResponse.json({ status: "sent" }, { status: 200 });
  }

  const webhookUrl = process.env.CONTACT_WEBHOOK_URL;

  if (!webhookUrl) {
    logger.warn("contact.not_configured");
    return NextResponse.json(
      {
        error: {
          code: "NOT_CONFIGURED",
          message:
            "The contact form is not connected to a delivery service yet, so this message would not reach anyone. Please use the email address shown instead.",
        },
      },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // A `text` field makes this work with Slack and Discord as-is, while
        // the structured fields suit a generic endpoint.
        text: `New contact message from ${parsed.data.name} <${parsed.data.email}>\n\n${parsed.data.message}`,
        name: parsed.data.name,
        email: parsed.data.email,
        message: parsed.data.message,
        receivedAt: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Webhook responded with ${response.status}`);
    }

    logger.info("contact.delivered");
    return NextResponse.json({ status: "sent" }, { status: 200 });
  } catch (error) {
    logger.error("contact.delivery_failed", describeError(error));
    return NextResponse.json(
      {
        error: {
          code: "DELIVERY_FAILED",
          message:
            "We could not deliver your message just now. Please try again, or use the email address shown.",
        },
      },
      { status: 502 },
    );
  }
}

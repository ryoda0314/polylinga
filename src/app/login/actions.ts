"use server";

import { headers } from "next/headers";
import { sendLinkMail } from "@/lib/email";
import { getDict } from "@/lib/i18n";
import { consume, refund } from "@/lib/metering";
import { LAUNCH_NATIVE } from "@/lib/settings";
import { safeNext } from "@/lib/safe-next";
import { createAdminClient } from "@/lib/supabase/server";

// Signing up and a forgotten password, with ことのあめ's own emails. The shared Supabase project confirms sign-ups at once
// and its mails and redirect list are the old app's, so the account is made here and the link goes straight to
// /auth/confirm (a token hash, so it also works when the mail is opened in another browser).

const MIN_PASSWORD = 8;
const PUBLIC_URL = process.env.NEXT_PUBLIC_APP_URL || "https://polylinga.vercel.app";
const OUR_ORIGINS = [PUBLIC_URL, "https://polylinga.vercel.app", "http://localhost:3000", "http://localhost:3001", "http://localhost:3005"];

export type MailResult = { ok: true } | { ok: false; reason: "invalid" | "exists" | "weak" | "limit" | "failed" };

/** Where the link in a mail points: the site the form was sent from when it is one of ours, else the public address. */
async function appUrl(): Promise<string> {
  const origin = (await headers()).get("origin");
  return origin && OUR_ORIGINS.includes(origin) ? origin : PUBLIC_URL;
}

function cleanEmail(value: unknown): string | null {
  const email = String(value ?? "").trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

async function confirmUrl(tokenHash: string, type: "signup" | "magiclink" | "recovery", next: string) {
  return `${await appUrl()}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=${type}&next=${encodeURIComponent(next)}`;
}

/** Counted per address and for the whole service, so the form cannot be used to mail strangers. */
async function mail(userId: string, to: string, kind: "confirm" | "reset", url: string): Promise<MailResult> {
  const use = await consume(userId, "emails");
  if (!use.ok) return { ok: false, reason: use.reason === "error" ? "failed" : "limit" };
  const t = getDict(LAUNCH_NATIVE).mail;
  const sent = await sendLinkMail(
    to,
    kind === "confirm"
      ? { subject: t.confirmSubject, title: t.confirmTitle, body: t.confirmBody, button: t.confirmButton, url, linkNote: t.linkNote, ignore: t.ignore }
      : { subject: t.resetSubject, title: t.resetTitle, body: t.resetBody, button: t.resetButton, url, linkNote: t.linkNote, ignore: t.ignore },
  );
  if (!sent) {
    await refund(userId, "emails");
    return { ok: false, reason: "failed" };
  }
  return { ok: true };
}

/** Where a confirmation mail's link leads: where the sign-up was headed (a sister app's つなぐ), else the first steps. */
const afterConfirm = (next?: string) => (next ? safeNext(next, "/start") : "/start");

/**
 * 新しく登録: the account is made unconfirmed (it cannot log in yet) and the mail's link confirms it and signs them in,
 * then goes on to `next` when the sign-up began somewhere (a sister app's つなぐ).
 */
export async function register(email: string, password: string, next?: string): Promise<MailResult> {
  const address = cleanEmail(email);
  if (!address) return { ok: false, reason: "invalid" };
  if (typeof password !== "string" || password.length < MIN_PASSWORD || password.length > 72) return { ok: false, reason: "weak" };
  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: "signup", email: address, password });
  if (error || !data.user) {
    if (error?.code === "email_exists") return { ok: false, reason: "exists" };
    if (error?.code === "weak_password") return { ok: false, reason: "weak" };
    console.error("[register]", error?.code, error?.message);
    return { ok: false, reason: "failed" };
  }
  return mail(data.user.id, address, "confirm", await confirmUrl(data.properties.hashed_token, "signup", afterConfirm(next)));
}

/** The confirmation mail again, for someone who tried to log in before confirming. Says nothing about other addresses. */
export async function resendConfirmation(email: string, next?: string): Promise<MailResult> {
  const address = cleanEmail(email);
  if (!address) return { ok: false, reason: "invalid" };
  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: "magiclink", email: address });
  if (error || !data.user || data.user.email_confirmed_at) return { ok: true };
  return mail(data.user.id, address, "confirm", await confirmUrl(data.properties.hashed_token, "magiclink", afterConfirm(next)));
}

/** パスワードを忘れた: whether the address is registered is never revealed. */
export async function requestReset(email: string): Promise<MailResult> {
  const address = cleanEmail(email);
  if (!address) return { ok: false, reason: "invalid" };
  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: "recovery", email: address });
  if (error || !data.user) return { ok: true };
  return mail(data.user.id, address, "reset", await confirmUrl(data.properties.hashed_token, "recovery", "/login/reset"));
}

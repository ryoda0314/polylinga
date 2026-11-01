"use server";

import { redirect } from "next/navigation";
import { saveUsername } from "@/lib/auth";
import { signInCopy } from "@/lib/i18n/sign-in";
import { safeNext } from "@/lib/safe-next";
import { connectLang } from "@/lib/sisters";
import { cleanUsername, USERNAME_MAX } from "@/lib/username";

export type NameState = { error: string | null };

/**
 * ユーザー名を決める, then on to where the new account was headed (/start, /app, a sister's つなぐ). The errors are in
 * the language of where it is headed (Korean on the way to a sister for Korean speakers).
 */
export async function chooseName(_prev: NameState, formData: FormData): Promise<NameState> {
  const asked = formData.get("next");
  const next = safeNext(typeof asked === "string" ? asked : null);
  const t = signInCopy(connectLang(next)).name;
  const name = cleanUsername(formData.get("username"));
  if (!name) return { error: t.invalid(USERNAME_MAX) };
  if (!(await saveUsername(name))) return { error: t.failed };
  redirect(next);
}

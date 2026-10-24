"use server";

import { redirect } from "next/navigation";
import { saveUsername } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { safeNext } from "@/lib/safe-next";
import { LAUNCH_NATIVE } from "@/lib/settings";
import { cleanUsername, USERNAME_MAX } from "@/lib/username";

export type NameState = { error: string | null };

/** ユーザー名を決める, then on to where the new account was headed (/start, /app, a sister's つなぐ). */
export async function chooseName(_prev: NameState, formData: FormData): Promise<NameState> {
  const t = getDict(LAUNCH_NATIVE);
  const name = cleanUsername(formData.get("username"));
  if (!name) return { error: t.name.invalid(USERNAME_MAX) };
  if (!(await saveUsername(name))) return { error: t.name.failed };
  const next = formData.get("next");
  redirect(safeNext(typeof next === "string" ? next : null));
}

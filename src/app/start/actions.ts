"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isLang } from "@/lib/langs";
import { LAUNCH_NATIVE, LAUNCH_TARGETS } from "@/lib/settings";

export async function chooseTarget(formData: FormData) {
  const { supabase, user } = await requireUser();
  const target = formData.get("target_lang");
  if (!isLang(target) || !LAUNCH_TARGETS.includes(target)) redirect("/start?change=1&error=1");

  // Only the language columns: an existing accent and speech rate are kept.
  const { error } = await supabase.from("pl_settings").upsert({
    user_id: user.id,
    native_lang: LAUNCH_NATIVE,
    target_lang: target,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error("[start]", error.message);
    redirect("/start?change=1&error=1");
  }
  redirect("/app");
}

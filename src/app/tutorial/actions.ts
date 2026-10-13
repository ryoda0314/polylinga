"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

/** Done with the tutorial (or skipped it): it is not shown again by itself, and the first real rain comes. */
export async function finishTutorial() {
  const { supabase, user } = await requireUser();
  await supabase.from("pl_settings").update({ tutorial_seen_at: new Date().toISOString() }).eq("user_id", user.id);
  redirect("/app");
}

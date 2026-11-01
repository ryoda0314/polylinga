"use server";

import { revalidatePath } from "next/cache";
import { isUuid } from "@/lib/admin-usage-core";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

/** Leave an account out of the usage numbers (the admin's own, a test account), or count it again. */
export async function setExcluded(userId: string, excluded: boolean) {
  await requireAdmin();
  if (!isUuid(userId)) return;
  const admin = createAdminClient();
  const { error } = excluded
    ? await admin.from("pl_admin_excluded").upsert({ user_id: userId })
    : await admin.from("pl_admin_excluded").delete().eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin", "layout");
}

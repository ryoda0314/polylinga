"use server";

import { revalidatePath } from "next/cache";
import { embedMany } from "@/lib/ai";
import { requireAdmin } from "@/lib/auth";
import { LANGS, type Lang } from "@/lib/langs";
import { createAdminClient } from "@/lib/supabase/server";

type Status = "draft" | "approved" | "rejected";

async function embedSentences(ids: string[]) {
  if (ids.length === 0) return;
  const admin = createAdminClient();
  const { data } = await admin.from("pl_sentences").select("id, ja, en, ko, zh").in("id", ids);
  const items = (data ?? []).flatMap((s) =>
    LANGS.map((lang) => ({ sentence_id: s.id as string, lang, text: (s as Record<Lang, string>)[lang] })),
  );
  const vectors = await embedMany(items.map((i) => i.text));
  const { error } = await admin
    .from("pl_sentence_embeddings")
    .upsert(items.map((item, i) => ({ sentence_id: item.sentence_id, lang: item.lang, embedding: vectors[i] })));
  if (error) throw new Error(error.message);
}

/** Approve every draft (patterns and sentences) of one function and make its sentences searchable. */
export async function approveFunction(functionId: string) {
  await requireAdmin();
  const admin = createAdminClient();
  await admin.from("pl_patterns").update({ status: "approved" }).eq("function_id", functionId).eq("status", "draft");
  const { data } = await admin
    .from("pl_sentences")
    .update({ status: "approved" })
    .eq("topic", functionId)
    .eq("status", "draft")
    .select("id");
  await embedSentences((data ?? []).map((r) => r.id));
  revalidatePath("/admin/library");
}

export async function setSentenceStatus(id: string, status: Status) {
  await requireAdmin();
  await createAdminClient().from("pl_sentences").update({ status }).eq("id", id);
  if (status === "approved") await embedSentences([id]);
  revalidatePath("/admin/library");
}

export async function setPatternStatus(id: string, status: Status) {
  await requireAdmin();
  await createAdminClient().from("pl_patterns").update({ status }).eq("id", id);
  revalidatePath("/admin/library");
}

export type EditState = { error: string | null; saved: boolean };

export async function updateSentence(id: string, _prev: EditState, formData: FormData): Promise<EditState> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: sentence } = await admin.from("pl_sentences").select("id, topic, status, zh").eq("id", id).maybeSingle();
  if (!sentence) return { error: "見つかりません。", saved: false };

  const [{ data: marks }, { data: patterns }] = await Promise.all([
    admin.from("pl_sentence_patterns").select("pattern_id, lang").eq("sentence_id", id),
    admin.from("pl_patterns").select("id, lang").eq("function_id", sentence.topic),
  ]);

  const texts = {} as Record<Lang, string>;
  const rows: { sentence_id: string; pattern_id: string; lang: Lang; start_index: number; end_index: number }[] = [];
  for (const lang of LANGS) {
    const text = String(formData.get(`text_${lang}`) ?? "").trim();
    const mark = String(formData.get(`mark_${lang}`) ?? "").trim();
    if (!text) return { error: `${lang.toUpperCase()} の文が空です。`, saved: false };
    texts[lang] = text;
    if (!mark) continue;
    const start = text.indexOf(mark);
    if (start === -1) return { error: `${lang.toUpperCase()}: 「${mark}」が文の中にありません。`, saved: false };
    const patternId =
      marks?.find((m) => m.lang === lang)?.pattern_id ?? patterns?.find((p) => p.lang === lang)?.id ?? null;
    if (patternId) rows.push({ sentence_id: id, pattern_id: patternId, lang, start_index: start, end_index: start + mark.length });
  }

  // Checked pinyin belongs to the old Chinese text; the app falls back to generated pinyin until it is checked again.
  const changes = texts.zh !== undefined && texts.zh !== sentence.zh ? { ...texts, zh_pinyin: null } : texts;
  const { error } = await admin.from("pl_sentences").update(changes).eq("id", id);
  if (error) return { error: error.message, saved: false };
  await admin.from("pl_sentence_patterns").delete().eq("sentence_id", id);
  if (rows.length) await admin.from("pl_sentence_patterns").insert(rows);
  if (sentence.status === "approved") await embedSentences([id]);
  revalidatePath("/admin/library");
  return { error: null, saved: true };
}

export async function updatePattern(id: string, _prev: EditState, formData: FormData): Promise<EditState> {
  await requireAdmin();
  const form = String(formData.get("form") ?? "").trim();
  const examples = String(formData.get("examples") ?? "").trim();
  const meaning = Object.fromEntries(LANGS.map((l) => [l, String(formData.get(`meaning_${l}`) ?? "").trim()]));
  if (!form) return { error: "かたちが空です。", saved: false };
  if (LANGS.some((l) => !meaning[l])) return { error: "説明は4言語とも必要です。", saved: false };
  const { error } = await createAdminClient()
    .from("pl_patterns")
    .update({ form, examples: examples || null, meaning })
    .eq("id", id);
  if (error) return { error: error.message, saved: false };
  revalidatePath("/admin/library");
  return { error: null, saved: true };
}

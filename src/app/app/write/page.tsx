import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { langClass } from "@/lib/langs";
import { requireSettings } from "@/lib/settings";
import styles from "../app.module.css";
import { SayForm } from "./SayForm";
import { WriteHistory } from "./WriteHistory";

export const metadata = { title: "書いてみる" };

type Row = {
  id: string;
  intent: string | null;
  pl_patterns: { form: string } | null;
  pl_corrections: { corrected: string }[];
};

export default async function WritePage() {
  const settings = await requireSettings();
  const { supabase } = await requireUser();
  const t = getDict(settings.nativeLang);
  const target = settings.targetLang;

  const { data } = await supabase
    .from("pl_sayings")
    .select("id, intent, pl_patterns(form), pl_corrections(corrected)")
    .eq("target_lang", target)
    .order("created_at", { ascending: false })
    .order("created_at", { referencedTable: "pl_corrections", ascending: false })
    .limit(1, { referencedTable: "pl_corrections" })
    .limit(20);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className={styles.body}>
      <SayForm
        labels={{
          title: t.write.title,
          lead: t.write.lead(t.start.targets[target]),
          input: t.write.inputLabel,
          placeholder: t.write.placeholder,
          submit: t.write.submit,
          pending: t.write.pending,
        }}
        nativeClass={langClass(settings.nativeLang)}
      />

      <WriteHistory
        rows={rows.map((row) => ({
          id: row.id,
          main: row.pl_corrections[0]?.corrected ?? t.write.notTried,
          sub: row.intent ?? (row.pl_patterns ? t.write.fromShower : ""),
        }))}
        targetClass={langClass(target)}
        nativeClass={langClass(settings.nativeLang)}
        labels={{
          title: t.write.recentTitle,
          none: t.write.recentNone,
          edit: t.write.edit,
          done: t.write.editDone,
          delete: t.write.delete,
          confirm: t.write.deleteConfirm,
          all: t.write.deleteAll,
          allConfirm: t.write.deleteAllConfirm,
          note: t.write.deleteNote,
          deleting: t.write.deleting,
        }}
      />
    </div>
  );
}

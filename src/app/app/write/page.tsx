import Link from "next/link";
import { Icon } from "@/components/Icon";
import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { langClass } from "@/lib/langs";
import { requireSettings } from "@/lib/settings";
import styles from "../app.module.css";
import { SayForm } from "./SayForm";

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

      <section>
        <div className={styles.listHead}>
          <h2>{t.write.recentTitle}</h2>
        </div>
        {rows.length === 0 ? (
          <p className={styles.empty}>{t.write.recentNone}</p>
        ) : (
          rows.map((row) => (
            <Link key={row.id} href={`/app/s/${row.id}`} className={styles.rowLink}>
              <span className={styles.rowText}>
                <span className={`${styles.rowMain} ${langClass(target)}`}>
                  {row.pl_corrections[0]?.corrected ?? t.write.notTried}
                </span>
                <span className={`${styles.rowSub} ${langClass(settings.nativeLang)}`}>
                  {row.intent ?? (row.pl_patterns ? t.write.fromShower(row.pl_patterns.form) : "")}
                </span>
              </span>
              <Icon name="arrow" size={18} />
            </Link>
          ))
        )}
      </section>
    </div>
  );
}

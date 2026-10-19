import Link from "next/link";
import { Icon } from "@/components/Icon";
import { requireUser } from "@/lib/auth";
import { formatExport } from "@/lib/export";
import { getDict } from "@/lib/i18n";
import { loadExport } from "@/lib/me";
import { requireSettings } from "@/lib/settings";
import styles from "../../app.module.css";
import { ExportActions } from "./ExportActions";

export const metadata = { title: "学習の記録" };

/**
 * 学習の記録: everything in 自分 as one text, to keep or to paste into an AI the learner chooses (the app itself makes
 * no AI call for it). Shown in full, so they can see what they would be handing over.
 */
export default async function ExportPage() {
  const [{ user }, settings] = await Promise.all([requireUser(), requireSettings()]);
  const t = getDict(settings.nativeLang);
  const data = await loadExport(
    user.id,
    settings.targetLang,
    settings.nativeLang,
    { target: t.common.langs[settings.targetLang], native: t.common.langs[settings.nativeLang] },
    settings.rainCue,
  );
  const text = formatExport(data, t.exportDoc);

  return (
    <>
      <header className={styles.subbar}>
        <Link href="/app/me" className={styles.iconLink} aria-label={t.common.back}>
          <Icon name="back" size={22} />
        </Link>
        <h1 className={styles.subtitleStrong}>{t.me.exportTitle}</h1>
      </header>
      <div className={`${styles.bodyTight} ${styles.narrow}`}>
        <div className={styles.stackSm}>
          <p className={styles.lead}>{t.me.exportLead}</p>
          <ExportActions
            text={text}
            fileName={`kotonoame-${settings.targetLang}-${data.today}.md`}
            labels={{ copy: t.me.exportCopy, copied: t.me.exportCopied, failed: t.me.exportCopyFailed, save: t.me.exportSave }}
          />
          <p className={styles.note}>{t.me.exportNote}</p>
          <pre className={styles.exportText} tabIndex={0}>
            {text}
          </pre>
        </div>
      </div>
    </>
  );
}

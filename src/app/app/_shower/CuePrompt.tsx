"use client";

import { useState, useTransition } from "react";
import { CuePicker } from "@/components/CuePicker";
import { getDict } from "@/lib/i18n";
import type { Lang } from "@/lib/langs";
import { setRainCue } from "../actions";
import styles from "./shower.module.css";

/**
 * Asked once, after the learner's first rain: when will they bathe in it? Tying it to something they do every day
 * (電車に乗ったら) is what lets it become a habit; nothing reminds or scolds them if they do not.
 */
export function CuePrompt({ native }: { native: Lang }) {
  const t = getDict(native);
  const [value, setValue] = useState<string | null>(null);
  const [answered, setAnswered] = useState<{ cue: string | null } | null>(null);
  const [pending, startSaving] = useTransition();

  function save(cue: string | null) {
    startSaving(async () => {
      await setRainCue(cue);
      setAnswered({ cue });
    });
  }

  if (answered) {
    return answered.cue ? (
      <p className={styles.cueDone} role="status">
        {t.shower.cueSet(answered.cue)}
      </p>
    ) : null;
  }
  return (
    <section className={styles.cue} aria-labelledby="cue-ask">
      <h2 id="cue-ask" className={styles.cueTitle}>
        {t.shower.cueAsk}
      </h2>
      <p className={styles.note}>{t.shower.cueWhy}</p>
      <CuePicker
        value={value}
        onChange={setValue}
        options={t.shower.cueOptions}
        labels={{ own: t.shower.cueOwn, ownLabel: t.shower.cueOwnLabel, ownPlaceholder: t.shower.cueOwnPlaceholder }}
      />
      <div className={styles.cueActions}>
        <button type="button" className="btn" disabled={!value || pending} onClick={() => save(value)}>
          {t.shower.cueSave}
        </button>
        <button type="button" className={styles.reportLink} disabled={pending} onClick={() => save(null)}>
          {t.shower.cueSkip}
        </button>
      </div>
    </section>
  );
}

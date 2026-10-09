"use client";

import { useActionState, useState } from "react";
import { ACCENTS, type Accent, type Lang } from "@/lib/langs";
import type { Settings } from "@/lib/settings";
import { saveSettings, type SettingsState } from "../actions";
import styles from "../app.module.css";

const ACCENT_HEX: Record<Accent, string> = {
  rain: "#0A64F0",
  ink: "#172033",
  hydrangea: "#6A4FE0",
  dusk: "#B9462A",
};

export function SettingsForm({
  settings,
  targets,
  labels,
}: {
  settings: Settings;
  targets: { value: Lang; label: string }[];
  labels: {
    native: string;
    nativeFixed: string;
    nativeNote: string;
    target: string;
    accent: string;
    accentNames: Record<Accent, string>;
    preview: string;
    rate: string;
    rates: { slow: string; normal: string; fast: string };
    save: string;
    saving: string;
  };
}) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(saveSettings, {
    message: null,
    error: false,
  });
  // Preview the accent before saving: the whole app shell reads data-accent.
  const [accent, setAccent] = useState<Accent>(settings.accent);
  const rates = [
    { value: 0.75, label: labels.rates.slow },
    { value: 1, label: labels.rates.normal },
    { value: 1.25, label: labels.rates.fast },
  ];

  return (
    <form action={formAction} className={styles.stack} data-accent={accent}>
      <div className={styles.field}>
        <span className="label">{labels.native}</span>
        <span>{labels.nativeFixed}</span>
        <span className={styles.note}>{labels.nativeNote}</span>
      </div>
      <div className={styles.field}>
        <label htmlFor="target_lang" className="label">
          {labels.target}
        </label>
        <select id="target_lang" name="target_lang" defaultValue={settings.targetLang} className={styles.select}>
          {targets.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <fieldset className={styles.field} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label" style={{ marginBottom: 8 }}>
          {labels.accent}
        </legend>
        <div className={styles.swatches}>
          {ACCENTS.map((a) => (
            <label key={a} className={styles.swatch}>
              <input type="radio" name="accent" value={a} checked={accent === a} onChange={() => setAccent(a)} />
              <span className={styles.dot} style={{ background: ACCENT_HEX[a] }} />
              {labels.accentNames[a]}
            </label>
          ))}
        </div>
        <div className={styles.panel} style={{ background: "var(--paper)", border: "1px solid var(--line)" }}>
          <span className={styles.note}>{labels.preview}</span>
          <span className="t-ko" style={{ fontSize: 20, fontWeight: 500 }}>
            내일 카페 <span className="mark">갈래</span>?
          </span>
        </div>
      </fieldset>

      <fieldset className={styles.field} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label" style={{ marginBottom: 8 }}>
          {labels.rate}
        </legend>
        <div className={styles.segmented}>
          {rates.map((r) => (
            <label key={r.value} className={styles.segment}>
              <input type="radio" name="speech_rate" value={r.value} defaultChecked={settings.speechRate === r.value} />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>

      <button type="submit" className="btn" disabled={pending}>
        {pending ? labels.saving : labels.save}
      </button>
      {state.message ? (
        <p className={state.error ? styles.error : styles.saved} role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

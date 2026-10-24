"use client";

import { useEffect, useRef, useState } from "react";
import { CuePicker } from "@/components/CuePicker";
import { ACCENTS, type Accent, type Lang } from "@/lib/langs";
import type { Settings } from "@/lib/settings";
import { saveSettings, type SettingsInput } from "../actions";
import styles from "../app.module.css";

const ACCENT_HEX: Record<Accent, string> = {
  rain: "#0A64F0",
  ink: "#172033",
  hydrangea: "#6A4FE0",
  dusk: "#B9462A",
};

/** How long typing has to pause before it is saved. */
export const TYPING_PAUSE_MS = 800;

type Field = "target" | "accent" | "rate" | "cue" | "share";
type Status = { field: Field; kind: "saving" | "saved" | "failed"; message: string | null };

/**
 * Settings save themselves, so nothing is lost to a forgotten button: a pick at once, typing once it pauses (or when
 * the learner leaves the field or the page). How it went shows under the setting that changed.
 */
export function SettingsForm({
  settings,
  targets,
  labels,
}: {
  settings: Settings;
  targets: { value: Lang; label: string }[];
  labels: {
    autosave: string;
    native: string;
    nativeFixed: string;
    nativeNote: string;
    target: string;
    accent: string;
    accentNames: Record<Accent, string>;
    preview: string;
    rate: string;
    rates: { slow: string; normal: string; fast: string };
    cue: string;
    cueOptions: readonly string[];
    cueOwn: string;
    cueOwnLabel: string;
    cueOwnPlaceholder: string;
    cueNone: string;
    cueNote: string;
    share: string;
    shareLabel: string;
    shareNote: string;
    saving: string;
    saved: string;
    saveFailed: string;
  };
}) {
  const [values, setValues] = useState<SettingsInput>(() => ({
    targetLang: settings.targetLang,
    accent: settings.accent,
    speechRate: settings.speechRate,
    rainCue: settings.rainCue,
    shareRain: settings.shareRain,
  }));
  const [status, setStatus] = useState<Status | null>(null);
  // What is on screen, whole (each save sends all of it), and typing still waiting for its pause.
  const latest = useRef(values);
  const waiting = useRef<{ timer: number; save: () => void } | null>(null);
  const saves = useRef(0);
  const rates = [
    { value: 0.75, label: labels.rates.slow },
    { value: 1, label: labels.rates.normal },
    { value: 1.25, label: labels.rates.fast },
  ];

  async function save(field: Field) {
    const n = ++saves.current;
    setStatus({ field, kind: "saving", message: null });
    const result = await saveSettings(latest.current).catch(() => ({ message: labels.saveFailed, error: true }));
    // A later change speaks for itself.
    if (n === saves.current) setStatus({ field, kind: result.error ? "failed" : "saved", message: result.message });
  }

  function change(field: Field, patch: Partial<SettingsInput>, typed = false) {
    latest.current = { ...latest.current, ...patch };
    setValues(latest.current);
    if (waiting.current) window.clearTimeout(waiting.current.timer);
    waiting.current = null;
    if (!typed) {
      void save(field);
      return;
    }
    const later = () => {
      waiting.current = null;
      void save(field);
    };
    waiting.current = { timer: window.setTimeout(later, TYPING_PAUSE_MS), save: later };
  }

  /** Typing still waiting is saved now: the learner left the field, pressed Enter, or is leaving the page. */
  function flush() {
    const pending = waiting.current;
    if (!pending) return;
    window.clearTimeout(pending.timer);
    pending.save();
  }

  useEffect(() => {
    const pending = waiting;
    return () => {
      if (!pending.current) return;
      window.clearTimeout(pending.current.timer);
      pending.current.save();
    };
  }, []);

  const said = (field: Field) =>
    status?.field === field ? (
      <p className={status.kind === "failed" ? styles.error : styles.saved} role="status">
        {status.kind === "saving" ? labels.saving : status.kind === "saved" ? labels.saved : (status.message ?? labels.saveFailed)}
      </p>
    ) : null;

  return (
    <form
      className={styles.stack}
      data-accent={values.accent}
      onBlur={flush}
      onSubmit={(e) => {
        e.preventDefault();
        flush();
      }}
    >
      <p className={styles.note}>{labels.autosave}</p>
      <div className={styles.field}>
        <span className="label">{labels.native}</span>
        <span>{labels.nativeFixed}</span>
        <span className={styles.note}>{labels.nativeNote}</span>
      </div>
      <div className={styles.field}>
        <label htmlFor="target_lang" className="label">
          {labels.target}
        </label>
        <select
          id="target_lang"
          name="target_lang"
          value={values.targetLang}
          onChange={(e) => change("target", { targetLang: e.target.value as Lang })}
          className={styles.select}
        >
          {targets.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {said("target")}
      </div>

      <fieldset className={styles.field} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label" style={{ marginBottom: 8 }}>
          {labels.accent}
        </legend>
        <div className={styles.swatches}>
          {ACCENTS.map((a) => (
            <label key={a} className={styles.swatch}>
              <input type="radio" name="accent" value={a} checked={values.accent === a} onChange={() => change("accent", { accent: a })} />
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
        {said("accent")}
      </fieldset>

      <fieldset className={styles.field} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label" style={{ marginBottom: 8 }}>
          {labels.rate}
        </legend>
        <div className={styles.segmented}>
          {rates.map((r) => (
            <label key={r.value} className={styles.segment}>
              <input
                type="radio"
                name="speech_rate"
                value={r.value}
                checked={values.speechRate === r.value}
                onChange={() => change("rate", { speechRate: r.value })}
              />
              {r.label}
            </label>
          ))}
        </div>
        {said("rate")}
      </fieldset>

      <fieldset className={styles.field} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label" style={{ marginBottom: 8 }}>
          {labels.cue}
        </legend>
        <CuePicker
          value={values.rainCue}
          onChange={(cue, typed) => change("cue", { rainCue: cue }, typed)}
          options={labels.cueOptions}
          labels={{ own: labels.cueOwn, ownLabel: labels.cueOwnLabel, ownPlaceholder: labels.cueOwnPlaceholder, none: labels.cueNone }}
        />
        <span className={styles.note}>{labels.cueNote}</span>
        {said("cue")}
      </fieldset>

      <fieldset className={styles.field} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label" style={{ marginBottom: 8 }}>
          {labels.share}
        </legend>
        <label className={styles.check}>
          <input
            type="checkbox"
            name="share_rain"
            checked={values.shareRain}
            onChange={(e) => change("share", { shareRain: e.target.checked })}
          />
          {labels.shareLabel}
        </label>
        <span className={styles.note}>{labels.shareNote}</span>
        {said("share")}
      </fieldset>
    </form>
  );
}

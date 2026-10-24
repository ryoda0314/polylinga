"use client";

import { useState } from "react";
import styles from "./CuePicker.module.css";

/**
 * Choose when to bathe in the rain: one of a few everyday moments, the learner's own (〜したら), or, in settings, none.
 * Inside a form, `name` sends the choice with it. `typed` marks a change made by typing their own (or opening it to),
 * which settings saves once the typing pauses rather than at each key.
 */
export function CuePicker({
  value,
  onChange,
  options,
  labels,
  name,
}: {
  value: string | null;
  onChange: (value: string | null, typed: boolean) => void;
  options: readonly string[];
  labels: { own: string; ownLabel: string; ownPlaceholder: string; none?: string };
  name?: string;
}) {
  const isOwn = (v: string | null) => v !== null && !options.includes(v);
  const [own, setOwn] = useState(() => isOwn(value));
  const [ownText, setOwnText] = useState(() => (isOwn(value) ? (value ?? "") : ""));

  return (
    <div className={styles.picker}>
      <div className={styles.chips}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={styles.chip}
            aria-pressed={!own && value === option}
            onClick={() => {
              setOwn(false);
              onChange(option, false);
            }}
          >
            {option}
          </button>
        ))}
        <button
          type="button"
          className={styles.chip}
          aria-pressed={own}
          onClick={() => {
            setOwn(true);
            onChange(ownText.trim() || null, true);
          }}
        >
          {labels.own}
        </button>
        {labels.none ? (
          <button
            type="button"
            className={styles.chip}
            aria-pressed={!own && value === null}
            onClick={() => {
              setOwn(false);
              onChange(null, false);
            }}
          >
            {labels.none}
          </button>
        ) : null}
      </div>
      {own ? (
        <label className={styles.own}>
          <span className="label">{labels.ownLabel}</span>
          <input
            value={ownText}
            maxLength={30}
            autoComplete="off"
            placeholder={labels.ownPlaceholder}
            className={styles.input}
            onChange={(e) => {
              setOwnText(e.target.value);
              onChange(e.target.value.trim() || null, true);
            }}
          />
        </label>
      ) : null}
      {name ? <input type="hidden" name={name} value={value ?? ""} /> : null}
    </div>
  );
}

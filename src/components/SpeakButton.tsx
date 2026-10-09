"use client";

import { useState } from "react";
import type { Lang } from "@/lib/langs";
import { playToEnd, stopAudio, type AudioSource } from "./audio";
import { Icon } from "./Icon";
import styles from "./SpeakButton.module.css";

export type { AudioSource };

// One clip at a time across the page.
let current: HTMLAudioElement | null = null;

/** Plays one sentence: stored clip, else generated on the server, else the browser's own voice. */
export function SpeakButton({
  text,
  lang,
  audio,
  rate = 1,
  size = "md",
  solid = false,
  label,
  failedLabel,
}: {
  text: string;
  lang: Lang;
  audio: AudioSource;
  rate?: number;
  size?: "md" | "lg";
  solid?: boolean;
  label: string;
  failedLabel: string;
}) {
  const [state, setState] = useState<"idle" | "loading" | "playing" | "error">("idle");

  async function play() {
    stopAudio(current);
    // Created inside the tap so mobile browsers treat it as user-initiated.
    const el = new Audio();
    current = el;
    setState("loading");
    const ok = await playToEnd(el, audio, text, lang, rate, () => setState("playing"));
    setState(ok ? "idle" : "error");
  }

  const className = [styles.button, size === "lg" ? styles.lg : "", solid ? styles.solid : "", styles[state]]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={className}
      onClick={play}
      aria-label={state === "error" ? failedLabel : label}
      title={state === "error" ? failedLabel : undefined}
      aria-busy={state === "loading"}
    >
      <Icon name="speaker" size={size === "lg" ? 26 : 20} />
    </button>
  );
}

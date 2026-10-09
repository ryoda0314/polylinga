"use client";

import { LANG_LOCALE, type Lang } from "@/lib/langs";

export type AudioSource = { src: string; fallback: string | null } | null;

function tryPlay(el: HTMLAudioElement, src: string, rate: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      el.onplaying = null;
      el.onerror = null;
      resolve(ok);
    };
    el.onplaying = () => done(true);
    el.onerror = () => done(false);
    el.src = src;
    el.playbackRate = rate;
    el.play().catch(() => done(false));
    // Generating a missing clip can take a few seconds; give up eventually.
    setTimeout(() => done(false), 20_000);
  });
}

function speakWithBrowser(text: string, lang: Lang, rate: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return resolve(false);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LANG_LOCALE[lang];
    u.rate = rate;
    u.onend = () => resolve(true);
    u.onerror = () => resolve(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  });
}

export function stopAudio(el: HTMLAudioElement | null) {
  el?.pause();
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}

/**
 * Play a sentence and resolve when it has finished (true) or nothing could play (false).
 * Order: the stored clip, then the server generating it, then the browser's own voice.
 * Reuse one element per page: once a tap has started it, mobile browsers allow later plays on it.
 */
export async function playToEnd(
  el: HTMLAudioElement,
  audio: AudioSource,
  text: string,
  lang: Lang,
  rate: number,
  onStart?: () => void,
): Promise<boolean> {
  stopAudio(el);
  for (const src of [audio?.src, audio?.fallback]) {
    if (!src) continue;
    if (await tryPlay(el, src, rate)) {
      onStart?.();
      await new Promise<void>((resolve) => {
        el.onended = () => resolve();
        el.onpause = () => resolve();
      });
      el.onended = null;
      el.onpause = null;
      return true;
    }
  }
  onStart?.();
  return speakWithBrowser(text, lang, rate);
}

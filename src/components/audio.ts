"use client";

import { LANG_LOCALE, type Lang } from "@/lib/langs";

export type AudioSource = { src: string; fallback: string | null } | null;

// The play each element is on. Starting another play, or stopping, ends the earlier one at once: a play that was still
// loading never comes back later to take the element (or the browser's voice) from the one that replaced it.
const turns = new WeakMap<HTMLAudioElement, AbortController>();

// Clips fetched ahead (the rest of a rain while its first sentence plays, the next rain while this one is on screen),
// kept as in-memory URLs: they start at once and still play in a tunnel.
const fetching = new Map<string, Promise<string | null>>();
const ready = new Map<string, string>();
const KEEP = 40;

function fetchClip(audio: NonNullable<AudioSource>, generate: boolean): Promise<string | null> {
  const key = audio.src;
  const known = fetching.get(key);
  if (known) return known;
  const job = (async () => {
    for (const url of generate ? [audio.src, audio.fallback] : [audio.src]) {
      if (!url) continue;
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const blobUrl = URL.createObjectURL(await res.blob());
        ready.set(key, blobUrl);
        return blobUrl;
      } catch {
        // Offline or blocked: the element tries the network itself when the sentence's turn comes.
      }
    }
    fetching.delete(key); // asked for again next time
    return null;
  })();
  fetching.set(key, job);
  if (fetching.size > KEEP) {
    const oldest = fetching.keys().next().value as string;
    fetching.delete(oldest);
    const url = ready.get(oldest);
    ready.delete(oldest);
    if (url) URL.revokeObjectURL(url);
  }
  return job;
}

/**
 * Fetch these clips one after another, in the order they will play, so each is there before its turn. With
 * `generate: false` only stored clips are fetched: a missing one would be made on the server, which allows only a few a
 * minute, so that waits until it is about to be heard.
 */
export function prefetchAudio(list: AudioSource[], { generate = true }: { generate?: boolean } = {}) {
  let chain: Promise<unknown> = Promise.resolve();
  for (const audio of list) if (audio) chain = chain.then(() => fetchClip(audio, generate));
}

function tryPlay(el: HTMLAudioElement, src: string, rate: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve(false);
    let settled = false;
    let timer = 0;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      el.removeEventListener("playing", onPlaying);
      el.removeEventListener("error", onError);
      signal.removeEventListener("abort", onAbort);
      resolve(ok);
    };
    const onPlaying = () => done(true);
    const onError = () => done(false);
    const onAbort = () => done(false);
    el.addEventListener("playing", onPlaying);
    el.addEventListener("error", onError);
    signal.addEventListener("abort", onAbort);
    el.src = src;
    // Loading a new source resets the rate to the default one (Safari does it late), so both are set.
    el.defaultPlaybackRate = rate;
    el.playbackRate = rate;
    el.play().catch(() => done(false));
    // Generating a missing clip can take a few seconds; give up eventually.
    timer = window.setTimeout(() => done(false), 20_000);
  });
}

function untilEnd(el: HTMLAudioElement, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      el.removeEventListener("ended", done);
      el.removeEventListener("pause", done);
      signal.removeEventListener("abort", done);
      resolve();
    };
    if (signal.aborted) return resolve();
    el.addEventListener("ended", done);
    el.addEventListener("pause", done);
    signal.addEventListener("abort", done);
  });
}

function speakWithBrowser(text: string, lang: Lang, rate: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || signal.aborted) return resolve(false);
    let settled = false;
    let timer = 0;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve(ok);
    };
    const onAbort = () => done(true);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LANG_LOCALE[lang];
    u.rate = rate;
    u.onend = () => done(true);
    u.onerror = () => done(false);
    signal.addEventListener("abort", onAbort);
    window.speechSynthesis.speak(u);
    // Some browsers never say when they have finished; a sentence is over well within this.
    timer = window.setTimeout(() => done(true), 3000 + (text.length * 400) / rate);
  });
}

export function stopAudio(el: HTMLAudioElement | null) {
  if (el) {
    turns.get(el)?.abort();
    turns.delete(el);
    el.pause();
  }
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}

/**
 * Play a sentence and resolve when it has finished or was stopped (true), or nothing could play (false).
 * Order: the clip fetched ahead, the stored clip, the server generating it, then the browser's own voice.
 * Reuse one element per page: once a tap has started it, mobile browsers allow later plays on it. A clip fetched ahead
 * is used only when it is already there, so a tap still starts playing straight away.
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
  const turn = new AbortController();
  turns.set(el, turn);
  const { signal } = turn;
  const fetched = audio ? ready.get(audio.src) : undefined;
  for (const src of [fetched, audio?.src, audio?.fallback]) {
    if (!src) continue;
    if (signal.aborted) return true;
    if (await tryPlay(el, src, rate, signal)) {
      onStart?.();
      await untilEnd(el, signal);
      return true;
    }
  }
  if (signal.aborted) return true;
  onStart?.();
  return speakWithBrowser(text, lang, rate, signal);
}

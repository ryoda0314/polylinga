import { useCallback, useState, useSyncExternalStore } from "react";

// Small things kept on this device only (localStorage): how the learner likes the rain (sound on or off, translation
// hidden) and half-written sentences, for a train ride that ends mid-sentence. Never anything that must persist: the
// browser may drop it, and every reader falls back to the default.

const EVENT = "kotonoame:local";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null || value === "") window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Private mode or storage switched off: the value simply is not kept.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/** A stored string, null on the server and until the page has hydrated. */
function useLocal(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
}

/** An on/off preference remembered on this device. */
export function usePref(key: string, fallback: boolean): [boolean, (value: boolean) => void] {
  const raw = useLocal(`kotonoame:${key}`);
  const set = useCallback((value: boolean) => write(`kotonoame:${key}`, value ? "1" : "0"), [key]);
  return [raw === null ? fallback : raw === "1", set];
}

/**
 * A text field's draft, kept on this device while the learner types. `wrap` turns a form action into one that lets
 * the draft go while it runs and keeps it again if the action comes back with an error (a redirect simply leaves).
 */
export function useDraft(key: string, field: string) {
  const storageKey = `kotonoame:draft:${key}`;
  const saved = useLocal(storageKey) ?? "";
  // null until the learner types here: until then the field shows what was saved.
  const [typed, setTyped] = useState<string | null>(null);
  const value = typed ?? saved;

  const change = useCallback(
    (next: string) => {
      setTyped(next);
      write(storageKey, next);
    },
    [storageKey],
  );

  const wrap = useCallback(
    <S extends { error: string | null }>(action: (prev: S, formData: FormData) => Promise<S>) =>
      async (prev: S, formData: FormData): Promise<S> => {
        const text = String(formData.get(field) ?? "");
        write(storageKey, null);
        const result = await action(prev, formData);
        if (result.error) write(storageKey, text);
        else setTyped("");
        return result;
      },
    [field, storageKey],
  );

  return { value, change, wrap };
}

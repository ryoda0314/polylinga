"use client";

import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icon";
import { getDict } from "@/lib/i18n";
import type { Lang } from "@/lib/langs";
import { WordSheet, type SheetSentence } from "../../_shower/WordSheet";
import styles from "../../app.module.css";

type Props = { sentence: SheetSentence; native: Lang; target: Lang; rate: number };

// Inside the app shell, so the sheet keeps the learner's accent (data-accent), but outside the sentence.
function sheetRoot(): Element {
  return document.querySelector("[data-accent]") ?? document.body;
}

/**
 * A sentence on a correction page that opens the word sheet when tapped, as sentences do in the rain.
 * Nothing shows until it is tapped, so it stays out of the way of reading. The sheet is rendered outside the
 * sentence (a sheet may not sit inside a <p>).
 */
export function MemoTap({ sentence, native, target, rate, className, children }: Props & { className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* The text keeps its own class inside: .tapText unsets everything on the button itself. */}
      <button type="button" className={styles.tapText} onClick={() => setOpen(true)}>
        {className ? <span className={className}>{children}</span> : children}
      </button>
      {open ? createPortal(<WordSheet sentence={sentence} native={native} target={target} rate={rate} onClose={() => setOpen(false)} />, sheetRoot()) : null}
    </>
  );
}

/** The same sheet from a quiet button, for learners who would not think to tap the sentence. */
export function MemoButton({ sentence, native, target, rate }: Props) {
  const t = getDict(native);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-quiet" onClick={() => setOpen(true)}>
        <Icon name="bookmark" size={18} />
        {t.saying.memoWord}
      </button>
      {open ? createPortal(<WordSheet sentence={sentence} native={native} target={target} rate={rate} onClose={() => setOpen(false)} />, sheetRoot()) : null}
    </>
  );
}

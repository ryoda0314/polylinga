"use client";

import { useState } from "react";
import { Icon } from "./Icon";

/** Copy a sentence so the learner can paste it into a real chat. */
export function CopyButton({
  text,
  labels,
}: {
  text: string;
  labels: { copy: string; copied: string; failed: string };
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <button type="button" className="btn-quiet" onClick={copy} aria-live="polite">
      <Icon name="copy" size={18} />
      {state === "copied" ? labels.copied : state === "failed" ? labels.failed : labels.copy}
    </button>
  );
}

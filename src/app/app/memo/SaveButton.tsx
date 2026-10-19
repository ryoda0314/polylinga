"use client";

import { Icon } from "@/components/Icon";

/**
 * メモする, and what happened to it on the button itself: while saving, then メモしました with a check until the learner
 * types again, so they need not look elsewhere to know the word went in.
 */
export function SaveButton({
  pending,
  done,
  labels,
}: {
  pending: boolean;
  done: boolean;
  labels: { save: string; saving: string; saved: string };
}) {
  return (
    <button type="submit" className="btn" disabled={pending} data-done={done || undefined} aria-live="polite">
      {pending ? (
        labels.saving
      ) : done ? (
        <>
          <Icon name="check" size={20} />
          {labels.saved}
        </>
      ) : (
        labels.save
      )}
    </button>
  );
}

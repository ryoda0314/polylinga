"use client";

import { CopyButton } from "@/components/CopyButton";
import styles from "../../app.module.css";

/** Copy the record to paste into an AI's chat, or keep it as a file. Nothing leaves the device from here. */
export function ExportActions({
  text,
  fileName,
  labels,
}: {
  text: string;
  fileName: string;
  labels: { copy: string; copied: string; failed: string; save: string };
}) {
  function save() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className={styles.actions}>
      <CopyButton text={text} labels={{ copy: labels.copy, copied: labels.copied, failed: labels.failed }} />
      <button type="button" className="btn-quiet" onClick={save}>
        {labels.save}
      </button>
    </div>
  );
}

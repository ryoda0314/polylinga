"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { deleteAllSayings, deleteSaying } from "../actions";
import styles from "../app.module.css";

export type HistoryRow = { id: string; main: string; sub: string };

/**
 * これまでに書いた文. 整理する turns the rows into a list to delete from (one by one, or all at once); every delete is
 * asked twice, since it also takes the corrections with it.
 */
export function WriteHistory({
  rows,
  targetClass,
  nativeClass,
  labels,
}: {
  rows: HistoryRow[];
  targetClass: string;
  nativeClass: string;
  labels: {
    title: string;
    none: string;
    edit: string;
    done: string;
    delete: string;
    confirm: string;
    all: string;
    allConfirm: string;
    note: string;
    deleting: string;
  };
}) {
  const [editing, setEditing] = useState(false);
  // The row (or "all") waiting for the second press.
  const [asking, setAsking] = useState<string | null>(null);
  const [pending, startDeleting] = useTransition();

  const text = (row: HistoryRow) => (
    <span className={styles.rowText}>
      <span className={`${styles.rowMain} ${targetClass}`}>{row.main}</span>
      {row.sub ? <span className={`${styles.rowSub} ${nativeClass}`}>{row.sub}</span> : null}
    </span>
  );

  return (
    <section>
      <div className={styles.listHead}>
        <h2>{labels.title}</h2>
        {rows.length ? (
          <button
            type="button"
            className={styles.headButton}
            aria-pressed={editing}
            onClick={() => {
              setEditing(!editing);
              setAsking(null);
            }}
          >
            {editing ? labels.done : labels.edit}
          </button>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className={styles.empty}>{labels.none}</p>
      ) : editing ? (
        <>
          <ul className={styles.plainList}>
            {rows.map((row) => (
              <li key={row.id} className={styles.row}>
                {text(row)}
                {asking === row.id ? (
                  <button
                    type="button"
                    className={styles.dangerButton}
                    disabled={pending}
                    onClick={() =>
                      startDeleting(async () => {
                        await deleteSaying(row.id);
                        setAsking(null);
                      })
                    }
                  >
                    {pending ? labels.deleting : labels.confirm}
                  </button>
                ) : (
                  <button type="button" className={styles.smallButton} disabled={pending} onClick={() => setAsking(row.id)}>
                    {labels.delete}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className={styles.confirmRow} style={{ paddingTop: 12 }}>
            <p className={styles.note}>{labels.note}</p>
            {asking === "all" ? (
              <button
                type="button"
                className={styles.dangerButton}
                disabled={pending}
                onClick={() =>
                  startDeleting(async () => {
                    await deleteAllSayings();
                    setAsking(null);
                    setEditing(false);
                  })
                }
              >
                {pending ? labels.deleting : labels.allConfirm}
              </button>
            ) : (
              <button type="button" className={styles.smallButton} disabled={pending} onClick={() => setAsking("all")}>
                {labels.all}
              </button>
            )}
          </div>
        </>
      ) : (
        rows.map((row) => (
          <Link key={row.id} href={`/app/s/${row.id}`} className={styles.rowLink}>
            {text(row)}
            <Icon name="arrow" size={18} />
          </Link>
        ))
      )}
    </section>
  );
}

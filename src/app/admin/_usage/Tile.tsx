import { num } from "@/lib/admin-usage-core";
import styles from "../usage.module.css";

/** One headline count. `hero` is the single number a page leads with. */
export function Tile({
  label,
  value,
  unit,
  note,
  hero,
}: {
  label: string;
  value: number;
  unit: string;
  note?: string;
  hero?: boolean;
}) {
  return (
    <div className={hero ? `${styles.tile} ${styles.hero}` : styles.tile}>
      <span className={styles.tileLabel}>{label}</span>
      <span className={styles.tileValue}>
        {num(value)}
        <span className={styles.tileUnit}>{unit}</span>
      </span>
      {note ? <span className={styles.tileNote}>{note}</span> : null}
    </div>
  );
}

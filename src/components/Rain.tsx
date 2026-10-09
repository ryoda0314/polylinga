import type { CSSProperties } from "react";
import styles from "./Rain.module.css";

// Thin streaks in the icon's colours, falling at slightly different speeds. Fixed values, so the server and
// the browser draw the same thing. Decoration only: hidden from screen readers, and still for reduced motion.
const STREAKS = [
  { left: 4, len: 54, dur: 3.4, delay: -0.6, color: "var(--rain-sky)" },
  { left: 13, len: 34, dur: 2.7, delay: -2.1, color: "var(--rain-blue)" },
  { left: 22, len: 62, dur: 3.9, delay: -1.2, color: "var(--rain-violet)" },
  { left: 31, len: 40, dur: 3.1, delay: -2.8, color: "var(--rain-sky)" },
  { left: 41, len: 28, dur: 2.5, delay: -0.3, color: "var(--rain-pink)" },
  { left: 50, len: 58, dur: 3.6, delay: -1.9, color: "var(--rain-blue)" },
  { left: 59, len: 36, dur: 2.9, delay: -3.2, color: "var(--rain-peach)" },
  { left: 68, len: 50, dur: 3.3, delay: -0.9, color: "var(--rain-sky)" },
  { left: 77, len: 30, dur: 2.6, delay: -2.4, color: "var(--rain-violet)" },
  { left: 86, len: 64, dur: 4.1, delay: -1.5, color: "var(--rain-blue)" },
  { left: 95, len: 38, dur: 3.0, delay: -0.1, color: "var(--rain-pink)" },
];

export function Rain() {
  return (
    <div className={styles.rain} aria-hidden="true">
      {STREAKS.map((s) => (
        <span
          key={s.left}
          style={
            {
              left: `${s.left}%`,
              height: s.len,
              background: s.color,
              animationDuration: `${s.dur}s`,
              animationDelay: `${s.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

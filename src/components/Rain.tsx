import type { CSSProperties } from "react";
import styles from "./Rain.module.css";

// Rain as it really falls: hairline streaks with fading tails, fast, all on one slant, at two depths
// (far: fine, slower, faint; near: longer, faster). The values come from a fixed seed, so the server and the
// browser draw the same thing. Decoration only: hidden from screen readers, and still for reduced motion.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const rand = seeded(7);
const STREAKS = Array.from({ length: 30 }, (_, i) => {
  const near = i % 3 === 0;
  return {
    left: Math.round(rand() * 1000) / 10,
    len: Math.round(near ? 70 + rand() * 60 : 30 + rand() * 30),
    width: near ? 1.5 : 1,
    opacity: Math.round((near ? 0.45 + rand() * 0.2 : 0.22 + rand() * 0.15) * 100) / 100,
    dur: Math.round((near ? 0.75 + rand() * 0.3 : 1.25 + rand() * 0.4) * 100) / 100,
    delay: -Math.round(rand() * 200) / 100,
    color: rand() < 0.8 ? "var(--rain-sky)" : "var(--rain-violet)",
  };
});

export function Rain() {
  return (
    <div className={styles.rain} aria-hidden="true">
      <div className={styles.sheet}>
        {STREAKS.map((s, i) => (
          <span
            key={i}
            style={
              {
                left: `${s.left}%`,
                height: s.len,
                width: s.width,
                opacity: s.opacity,
                "--c": s.color,
                animationDuration: `${s.dur}s`,
                animationDelay: `${s.delay}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}

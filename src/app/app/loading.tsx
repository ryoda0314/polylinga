"use client";

import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Logo } from "@/components/Logo";
import { getDict } from "@/lib/i18n";
import styles from "./app.module.css";

// Shown the moment a tab is tapped, while the page is put together on the server. The destination's own header
// appears at once; the quiet lines below fade in only if the wait is long enough to notice. In production the bar's
// links prefetch this, so the switch itself never waits for the server.
export default function Loading() {
  const path = usePathname();
  const t = getDict("ja"); // the app serves Japanese speakers only for now (LAUNCH_NATIVE)

  const lines = (
    <div className={styles.ghost} aria-hidden="true">
      <div className={styles.ghostLine} style={{ width: "72%" }} />
      <div className={styles.ghostLine} style={{ width: "48%" }} />
      <div className={styles.ghostBlock} />
      <div className={styles.ghostLine} style={{ width: "64%" }} />
      <div className={styles.ghostLine} style={{ width: "40%" }} />
    </div>
  );
  const subbar = (title: string, back: boolean, side?: React.ReactNode) => (
    <header className={styles.subbar}>
      {back ? (
        <span className={styles.iconLink} aria-hidden="true">
          <Icon name="back" size={22} />
        </span>
      ) : null}
      <span className={styles.subtitleStrong} style={back ? undefined : { paddingLeft: 12 }}>
        {title}
      </span>
      {side}
    </header>
  );

  if (path === "/app") {
    return (
      <div role="status" aria-label={t.common.loading}>
        <header className={styles.topbar}>
          <Logo size="sm" href={null} />
          <span className={`${styles.pair} ${styles.pairGhost}`} aria-hidden="true" />
        </header>
        <div className={styles.body}>{lines}</div>
      </div>
    );
  }
  if (path === "/app/write") {
    return (
      <div role="status" aria-label={t.common.loading} className={styles.body}>
        <span className={styles.h1}>{t.write.title}</span>
        {lines}
      </div>
    );
  }
  const pill = (icon: "search" | "sliders", label: string) => (
    <span className={styles.pair}>
      <Icon name={icon} size={18} />
      {label}
    </span>
  );
  const head =
    path === "/app/memo"
      ? subbar(t.words.title, false, pill("search", t.look.open))
      : path === "/app/memo/look"
        ? subbar(t.look.title, true)
        : path === "/app/me"
          ? subbar(t.me.title, false, pill("sliders", t.me.settings))
          : path === "/app/me/settings"
            ? subbar(t.me.settings, true)
            : subbar("", path.split("/").length > 3);
  return (
    <div role="status" aria-label={t.common.loading}>
      {head}
      <div className={styles.bodyTight}>{lines}</div>
    </div>
  );
}

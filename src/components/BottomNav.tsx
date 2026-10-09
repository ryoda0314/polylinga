"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import styles from "./BottomNav.module.css";

export function BottomNav({
  labels,
}: {
  labels: { shower: string; write: string; memo: string; me: string; label: string };
}) {
  const pathname = usePathname();
  const items = [
    { href: "/app", label: labels.shower, icon: "shower" as const, active: pathname === "/app" },
    {
      href: "/app/write",
      label: labels.write,
      icon: "pencil" as const,
      active: pathname.startsWith("/app/write") || pathname.startsWith("/app/s/"),
    },
    { href: "/app/memo", label: labels.memo, icon: "bookmark" as const, active: pathname.startsWith("/app/memo") },
    // Exact segment: "/app/memo" also starts with "/app/me".
    { href: "/app/me", label: labels.me, icon: "user" as const, active: pathname === "/app/me" || pathname.startsWith("/app/me/") },
  ];

  return (
    <nav className={styles.nav} aria-label={labels.label}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={item.active ? `${styles.item} ${styles.active}` : styles.item}
          aria-current={item.active ? "page" : undefined}
        >
          <Icon name={item.icon} size={22} />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

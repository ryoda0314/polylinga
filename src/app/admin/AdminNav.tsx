"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./admin.module.css";

const ITEMS = [
  { href: "/admin", label: "利用状況", active: (path: string) => path === "/admin" },
  { href: "/admin/users", label: "利用者", active: (path: string) => path.startsWith("/admin/users") },
  { href: "/admin/patterns", label: "かたちごと", active: (path: string) => path.startsWith("/admin/patterns") },
  { href: "/admin/apps", label: "姉妹アプリ", active: (path: string) => path.startsWith("/admin/apps") },
  { href: "/admin/library", label: "かたち図鑑", active: (path: string) => path.startsWith("/admin/library") },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className={styles.nav} aria-label="管理">
      {ITEMS.map((item) => {
        const active = item.active(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={active ? `${styles.navItem} ${styles.navActive}` : styles.navItem}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

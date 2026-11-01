import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "./AdminNav";
import styles from "./admin.module.css";

export const metadata = { title: "管理", robots: { index: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/admin" className={styles.brand}>
          ことのあめ 管理
        </Link>
        <AdminNav />
        <Link href="/app" className={styles.headerLink}>
          アプリに戻る
        </Link>
      </header>
      {children}
    </div>
  );
}

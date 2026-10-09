import Image from "next/image";
import Link from "next/link";
import styles from "./Logo.module.css";

const ICON_PX = { sm: 28, md: 34, lg: 88 } as const;

/** The app icon with ことのあめ in mincho. `lg` stacks them, for first screens. */
export function Logo({ size = "md", href = "/" }: { size?: keyof typeof ICON_PX; href?: string | null }) {
  const px = ICON_PX[size];
  const content = (
    <>
      <Image src="/icons/icon-192.png" alt="" width={px} height={px} className={styles.icon} priority={size === "lg"} />
      <span className={`wordmark-kana ${styles.word}`}>ことのあめ</span>
    </>
  );
  const className = `${styles.logo} ${styles[size]}`;
  return href ? (
    <Link href={href} className={className} aria-label="ことのあめ">
      {content}
    </Link>
  ) : (
    <span className={className}>{content}</span>
  );
}

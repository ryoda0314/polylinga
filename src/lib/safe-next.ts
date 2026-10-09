/** Only same-site paths, so a link in an email cannot send people elsewhere. */
export function safeNext(value: string | null, fallback = "/app"): string {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : fallback;
}

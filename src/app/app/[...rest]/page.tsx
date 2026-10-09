import { redirect } from "next/navigation";

// Old poly-lang URLs (/app/dashboard, /app/phrases, ...) may still be bookmarked or installed as a home-screen app.
export default function OldAppRoute() {
  redirect("/app");
}

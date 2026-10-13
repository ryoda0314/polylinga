import { redirect } from "next/navigation";
import { requireSettings } from "@/lib/settings";
import { tutorialData } from "@/lib/tutorial";
import { Tutorial } from "./Tutorial";

export const metadata = { title: "使い方" };

/** The hands-on tutorial: the loop of the rain, once, with real sentences in the language the learner chose. */
export default async function TutorialPage() {
  const settings = await requireSettings();
  const data = await tutorialData(settings.targetLang, settings.nativeLang);
  if (!data) redirect("/app");
  return (
    <div data-accent={settings.accent}>
      <Tutorial data={data} native={settings.nativeLang} target={settings.targetLang} rate={settings.speechRate} cue={settings.rainCue} />
    </div>
  );
}

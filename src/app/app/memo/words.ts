// The memo's shared shapes: a word as the page hands it to the client, and the stages it grows through.

export type Stage = "new" | "seen" | "used";
export const STAGES: Stage[] = ["new", "seen", "used"];

export type MemoWord = {
  id: string;
  text: string;
  note: string | null;
  memoCount: number;
  encounters: number;
  uses: number;
  /** The dictionary form it was picked with (語のまとまり), by which it is found in other sentences; null if typed alone. */
  base: string | null;
  /** The learner marked that they could not guess it (予想できなかった). */
  stuck: boolean;
  /** They chose to see its meaning (答え合わせ). */
  answered: boolean;
  stage: Stage;
  reading: string[] | null;
  since: string;
  /** Days since it last turned up in the rain or in the learner's own sentence; null if never. */
  metDaysAgo: number | null;
};

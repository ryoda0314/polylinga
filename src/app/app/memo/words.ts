// The memo's shared shapes: a word as the page hands it to the client, and the stages it grows through.

export type Stage = "new" | "seen" | "understood" | "used";
export const STAGES: Stage[] = ["new", "seen", "understood", "used"];

export type MemoWord = {
  id: string;
  text: string;
  note: string | null;
  memoCount: number;
  encounters: number;
  uses: number;
  understood: boolean;
  stage: Stage;
  reading: string[] | null;
  since: string;
  /** Days since it last turned up in the rain or in the learner's own sentence; null if never. */
  metDaysAgo: number | null;
};

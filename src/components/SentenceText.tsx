import type { ReactNode } from "react";

export type HighlightKind = "mark" | "ins" | "del" | "blank" | "memo";
export type Highlight = { start: number; end: number; kind: HighlightKind };

const CLASS: Record<Exclude<HighlightKind, "blank">, string> = { mark: "mark", ins: "hl-ins", del: "hl-del", memo: "hl-memo" };

/**
 * A sentence with pattern marks, correction edits, memo words, an optional blank, and optional
 * per-character readings (pinyin). Ranges are UTF-16 offsets into `text` and may overlap.
 */
export function SentenceText({
  text,
  highlights = [],
  reading = null,
  blankLabel = "空欄",
}: {
  text: string;
  highlights?: Highlight[];
  reading?: string[] | null;
  blankLabel?: string;
}) {
  const valid = highlights.filter((h) => h.start >= 0 && h.end <= text.length && h.start < h.end);
  const cuts = new Set([0, text.length]);
  for (const h of valid) {
    cuts.add(h.start);
    cuts.add(h.end);
  }
  const points = [...cuts].sort((a, b) => a - b);

  const out: ReactNode[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    const piece = text.slice(start, end);
    const kinds = valid.filter((h) => h.start <= start && h.end >= end).map((h) => h.kind);

    if (kinds.includes("blank")) {
      // Keep the hidden words' width so the sentence does not reflow; never expose them to readers.
      out.push(
        <span key={start} className="hl-blank">
          <span aria-hidden="true">{piece}</span>
          <span className="sr-only">{blankLabel}</span>
        </span>,
      );
      continue;
    }
    const content = withReading(piece, start, reading);
    const classes = kinds.map((k) => CLASS[k as Exclude<HighlightKind, "blank">]).join(" ");
    if (!classes) out.push(<span key={start}>{content}</span>);
    else if (kinds.includes("del")) out.push(<del key={start} className={classes}>{content}</del>);
    else if (kinds.includes("ins")) out.push(<ins key={start} className={classes}>{content}</ins>);
    else out.push(<span key={start} className={classes}>{content}</span>);
  }
  return <>{out}</>;
}

function withReading(piece: string, offset: number, reading: string[] | null): ReactNode {
  if (!reading) return piece;
  const nodes: ReactNode[] = [];
  let plain = "";
  for (let i = 0; i < piece.length; i++) {
    const rt = reading[offset + i];
    if (rt) {
      if (plain) nodes.push(plain);
      plain = "";
      nodes.push(
        <ruby key={i}>
          {piece[i]}
          <rt>{rt}</rt>
        </ruby>,
      );
    } else {
      plain += piece[i];
    }
  }
  if (plain) nodes.push(plain);
  return nodes;
}

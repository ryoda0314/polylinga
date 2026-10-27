// D. もう一度、名前と「今日の雨を、少し浴びてみる。」（はじめの頁の終わりの見出し）。下のタブと、はじめ方と、料金
// （はじめの頁の料金：浴びる・音声・メモは無料、AI 添削は1日20回まで無料）。
import { fall } from "../anim";
import { T } from "../timeline";
import { C, FONT } from "../theme";
import { Btn, Icon, type IconName } from "../ui";
import { NameMark } from "./Mark";

const TABS: [IconName, string][] = [
  ["shower", "浴びる"],
  ["pencil", "書いてみる"],
  ["bookmark", "メモ"],
  ["user", "自分"],
];

export function End({ frame }: { frame: number }) {
  const e = T.end;
  return (
    <>
      <NameMark frame={frame} icon={e.icon} word={e.word} lead={e.lead} line="今日の雨を、少し浴びてみる。" size={210} top={110} wordSize={88} leadSize={40} />
      <div style={{ position: "absolute", top: 600, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 48, ...fall(frame, e.rest, 10, 16) }}>
        {TABS.map(([icon, name]) => (
          <span key={name} style={{ display: "inline-flex", alignItems: "center", gap: 12, fontSize: 28, color: C.ink2, fontFamily: FONT.ja }}>
            <Icon name={icon} size={30} stroke={1.7} />
            {name}
          </span>
        ))}
      </div>
      <div style={{ position: "absolute", top: 715, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 26, ...fall(frame, e.rest + 8, 14, 18) }}>
        <Btn style={{ alignSelf: "center", minWidth: 380, minHeight: 80, fontSize: 30, borderRadius: 18 }}>無料ではじめる</Btn>
        <p style={{ margin: 0, fontSize: 25, color: C.muted, fontFamily: FONT.ja }}>浴びる・音声・メモは無料。AI 添削は1日20回まで無料。</p>
      </div>
    </>
  );
}
